import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.services';

@Component({
    selector: 'app-reset-password',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink],
    templateUrl: './reset-password.component.html',
    styleUrls: ['./reset-password.component.css']
})
export class ResetPasswordComponent implements OnInit {
    email: string = '';
    otp: string = '';
    newPassword: string = '';
    confirmPassword: string = '';

    message: string = '';
    isError: boolean = false;
    isLoading: boolean = false;

    constructor(
        private authService: AuthService,
        private router: Router,
        private route: ActivatedRoute
    ) { }

    ngOnInit(): void {
        // Get the email from query parameters
        this.route.queryParams.subscribe(params => {
            if (params['email']) {
                this.email = params['email'];
            }
        });

        if (!this.email) {
            this.message = 'No email provided. Please go back and request a new OTP.';
            this.isError = true;
        }
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
        }).subscribe({
            next: (res) => {
                this.isLoading = false;
                this.message = 'Password reset successfully. Redirecting to login...';
                this.isError = false;
                this.router.navigate(['/login']);
            },
            error: (err) => {
                this.isLoading = false;
                this.message = err.error?.message || err.error || 'Failed to reset password. Please check your OTP and try again.';
                this.isError = true;
            }
        });
    }
}
