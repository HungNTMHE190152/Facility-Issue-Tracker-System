import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../services/auth.services';

@Component({
    selector: 'app-forgot-password',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink],
    templateUrl: './forgot-password.component.html',
    styleUrls: ['./forgot-password.component.css']
})
export class ForgotPasswordComponent {
    step: number = 1;
    email: string = '';
    otp: string = '';
    newPassword: string = '';
    confirmPassword: string = '';

    message: string = '';
    isError: boolean = false;
    isLoading: boolean = false;

    constructor(private authService: AuthService, private router: Router) { }

    requestOtp() {
        if (!this.email) return;

        this.isLoading = true;
        this.message = '';
        this.isError = false;

        this.authService.forgotPassword(this.email).subscribe({
            next: (res) => {
                this.isLoading = false;
                this.step = 2;
                this.message = 'OTP has been sent to your email. Please check your inbox.';
                this.isError = false;
            },
            error: (err) => {
                this.isLoading = false;
                // In case the API returns a string or an object with a message property
                this.message = err.error?.message || err.error || 'Failed to send OTP. Please try again.';
                this.isError = true;
            }
        });
    }

    resetPassword() {
        if (!this.otp || !this.newPassword || !this.confirmPassword) {
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
        }).subscribe({
            next: (res) => {
                this.isLoading = false;
                this.message = 'Password reset successfully. Redirecting to login...';
                this.isError = false;
                setTimeout(() => {
                    this.router.navigate(['/login']);
                }, 2000);
            },
            error: (err) => {
                this.isLoading = false;
                this.message = err.error?.message || err.error || 'Failed to reset password. Please check your OTP and try again.';
                this.isError = true;
            }
        });
    }
}
