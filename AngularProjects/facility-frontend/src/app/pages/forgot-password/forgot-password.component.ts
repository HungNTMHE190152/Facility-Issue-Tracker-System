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
    email: string = '';

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
                this.message = 'OTP has been sent. Redirecting to reset password page...';
                this.isError = false;

                // Trì hoãn 1.5s để user kịp đọc thông báo
                setTimeout(() => {
                    this.router.navigate(['/reset-password'], { queryParams: { email: this.email } });
                }, 1500);
            },
            error: (err) => {
                this.isLoading = false;
                this.message = err.error?.message || err.error || 'Failed to send OTP. Please try again.';
                this.isError = true;
            }
        });
    }
}
