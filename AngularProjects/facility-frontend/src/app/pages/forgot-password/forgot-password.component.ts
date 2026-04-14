import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { finalize, timeout } from 'rxjs/operators';
import { AuthService } from '../../services/auth.services';
import { NotificationService } from '../../services/notification.service';

@Component({
    selector: 'app-forgot-password',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink],
    templateUrl: './forgot-password.component.html',
    styleUrls: ['./forgot-password.component.css']
})
export class ForgotPasswordComponent {
    email: string = '';

    message: string = '';
    isError: boolean = false;
    isLoading: boolean = false;
    otpSent: boolean = false;
    private hardTimeoutHandle: ReturnType<typeof setTimeout> | null = null;

    constructor(
        private authService: AuthService,
        private router: Router,
        private notificationService: NotificationService
    ) { }

    private resolveErrorMessage(err: any): string {
        const rawMessage = typeof err?.error === 'string'
            ? err.error
            : (typeof err?.error?.message === 'string' ? err.error.message : '');

        if (rawMessage.toLowerCase().includes('email does not exist')) {
            return 'Tài khoản không tồn tại trong hệ thống';
        }

        if (typeof err?.error === 'string' && err.error.trim()) {
            return err.error;
        }

        if (typeof err?.error?.message === 'string' && err.error.message.trim()) {
            return err.error.message;
        }

        if (err?.status === 400) {
            return 'Email does not exist in the system.';
        }

        return 'Failed to send OTP. Please try again.';
    }

    requestOtp() {
        if (!this.email || this.isLoading) return;

        if (this.hardTimeoutHandle) {
            clearTimeout(this.hardTimeoutHandle);
            this.hardTimeoutHandle = null;
        }

        this.isLoading = true;
        this.message = '';
        this.isError = false;

        // Hard failsafe: never allow UI to stay in Sending... forever.
        this.hardTimeoutHandle = setTimeout(() => {
            if (!this.isLoading) return;
            this.isLoading = false;
            this.otpSent = false;
            this.message = 'Request timed out. Please try again.';
            this.isError = true;
            this.notificationService.error(this.message);
        }, 10000);

        this.authService.forgotPassword(this.email)
            .pipe(
                timeout(8000),
                finalize(() => {
                    this.isLoading = false;
                    if (this.hardTimeoutHandle) {
                        clearTimeout(this.hardTimeoutHandle);
                        this.hardTimeoutHandle = null;
                    }
                })
            )
            .subscribe({
            next: (res) => {
                this.isLoading = false;
                this.message = 'OTP has been sent. You can send again with another email or continue to reset password.';
                this.isError = false;
                this.otpSent = true;
                this.notificationService.success(this.message);

                // Auto-navigate to reset page after OTP is sent successfully.
                setTimeout(() => {
                    this.goToResetPassword();
                }, 900);
            },
            error: (err) => {
                this.isLoading = false;
                this.message = this.resolveErrorMessage(err);
                this.isError = true;
                this.otpSent = false;
                this.notificationService.error(this.message);
            }
        });
    }

    onEmailChanged(): void {
        // Let user retry immediately with another email, no waiting state.
        if (this.isLoading) {
            this.isLoading = false;
        }

        if (this.hardTimeoutHandle) {
            clearTimeout(this.hardTimeoutHandle);
            this.hardTimeoutHandle = null;
        }

        this.otpSent = false;
    }

    goToResetPassword(): void {
        this.router.navigate(['/reset-password'], { queryParams: { email: this.email } });
    }
}
