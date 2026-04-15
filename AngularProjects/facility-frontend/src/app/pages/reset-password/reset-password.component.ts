import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { finalize, timeout } from 'rxjs/operators';
import { AuthService } from '../../services/auth.services';
import { NotificationService } from '../../services/notification.service';

@Component({
    selector: 'app-reset-password',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink],
    templateUrl: './reset-password.component.html',
    styleUrls: ['./reset-password.component.css']
})
export class ResetPasswordComponent implements OnInit, OnDestroy {
    email: string = '';
    otp: string = '';
    newPassword: string = '';
    confirmPassword: string = '';

    message: string = '';
    isError: boolean = false;
    isLoading: boolean = false;
    isSendingOtp: boolean = false;
    resendCooldownSeconds: number = 60;
    canResendOtp: boolean = false;
    resendUsed: boolean = false;
    private resendCooldownHandle: ReturnType<typeof setInterval> | null = null;
    private resendCooldownDeadlineMs: number = 0;

    constructor(
        private authService: AuthService,
        private router: Router,
        private route: ActivatedRoute,
        private notificationService: NotificationService,
        private cdr: ChangeDetectorRef
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

        return 'Failed to reset password. Please check your OTP and try again.';
    }

    ngOnInit(): void {
        // Get the email from query parameters
        this.route.queryParams.subscribe(params => {
            if (params['email']) {
                this.email = params['email'];
            }
        });

        this.startResendCooldown();

        if (!this.email) {
            this.message = 'No email provided. Please go back and request a new OTP.';
            this.isError = true;
        }
    }

    ngOnDestroy(): void {
        if (this.resendCooldownHandle) {
            clearInterval(this.resendCooldownHandle);
            this.resendCooldownHandle = null;
        }
    }

    private startResendCooldown(): void {
        if (this.resendCooldownHandle) {
            clearInterval(this.resendCooldownHandle);
            this.resendCooldownHandle = null;
        }

        this.canResendOtp = false;
        this.resendCooldownDeadlineMs = Date.now() + 60_000;
        this.resendCooldownSeconds = 60;

        const updateCountdown = () => {
            const remainingMs = this.resendCooldownDeadlineMs - Date.now();
            const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
            this.resendCooldownSeconds = remainingSeconds;
            this.cdr.detectChanges();

            if (remainingSeconds <= 0) {
                this.canResendOtp = true;
                if (this.resendCooldownHandle) {
                    clearInterval(this.resendCooldownHandle);
                    this.resendCooldownHandle = null;
                }
            }
        };

        updateCountdown();
        this.resendCooldownHandle = setInterval(updateCountdown, 250);
    }

    get resendButtonText(): string {
        if (this.isSendingOtp) return 'Sending OTP...';
        if (this.resendUsed) return 'Resend used';
        if (!this.canResendOtp) return `Send OTP again in ${this.resendCooldownSeconds}s`;
        return 'Send OTP to this email';
    }

    resendOtp() {
        if (!this.email?.trim()) {
            this.message = 'Please enter your email first.';
            this.isError = true;
            this.notificationService.error(this.message);
            return;
        }

        if (this.resendUsed) {
            this.message = 'You can only resend OTP once on this page.';
            this.isError = true;
            this.notificationService.warning(this.message);
            return;
        }

        if (!this.canResendOtp) {
            this.message = `Please wait ${this.resendCooldownSeconds}s before resending OTP.`;
            this.isError = true;
            this.notificationService.info(this.message);
            return;
        }

        this.isSendingOtp = true;
        this.message = '';
        this.isError = false;

        this.authService.forgotPassword(this.email.trim()).subscribe({
            next: () => {
                this.isSendingOtp = false;
                this.resendUsed = true;
                this.canResendOtp = false;
                this.message = 'OTP has been sent. Please check your email.';
                this.isError = false;
                this.notificationService.success(this.message);
            },
            error: (err) => {
                this.isSendingOtp = false;
                this.message = this.resolveErrorMessage(err);
                this.isError = true;
                this.notificationService.error(this.message);
            }
        });
    }

    resetPassword() {
        if (!this.email || !this.otp || !this.newPassword || !this.confirmPassword) {
            this.message = 'Please fill in all fields.';
            this.isError = true;
            return;
        }

        if (this.newPassword !== this.confirmPassword) {
            this.message = 'Passwords do not match.';
            this.isError = true;
            return;
        }

        this.isLoading = true;
        this.message = '';
        this.isError = false;

        this.authService.resetPassword({
            email: this.email,
            otp: this.otp,
            newPassword: this.newPassword
        }).pipe(
            timeout(10000),
            finalize(() => {
                this.isLoading = false;
            })
        ).subscribe({
            next: (res) => {
                this.message = 'Password reset successfully. Redirecting to login...';
                this.isError = false;
                this.notificationService.success(this.message);

                // Pass email and password to login page for auto-fill
                setTimeout(() => {
                    this.router.navigate(['/login'], {
                        queryParams: {
                            email: this.email,
                            password: this.newPassword
                        }
                    });
                }, 1500);
            },
            error: (err) => {
                this.message = this.resolveErrorMessage(err);
                this.isError = true;
                this.notificationService.error(this.message);
            }
        });
    }
}
