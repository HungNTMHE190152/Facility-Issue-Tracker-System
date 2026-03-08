import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.services';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.css'
})
export class ChangePasswordComponent {
  currentPassword = '';
  newPassword = '';
  confirmNewPassword = '';
  errorMessage = '';
  successMessage = '';
  isLoading = false;

  constructor(private auth: AuthService, private router: Router) { }

  onSubmit() {
    this.errorMessage = '';
    this.successMessage = '';

    const oldPass = this.currentPassword.trim();
    const newPass = this.newPassword.trim();
    const confirmPass = this.confirmNewPassword.trim();

    // Validate client-side
    if (!oldPass) {
      this.errorMessage = 'Please enter your current password';
      return;
    }
    if (!newPass) {
      this.errorMessage = 'Please enter a new password';
      return;
    }
    if (!confirmPass) {
      this.errorMessage = 'Please confirm your new password';
      return;
    }
    if (newPass !== confirmPass) {
      this.errorMessage = 'New password and accespt password do not match!!!';
      return;
    }
    if (newPass.length < 6) {
      this.errorMessage = 'Password must be at least 6 characters!!!';
      return;
    }

    this.isLoading = true;

    this.auth.changePassword({
      oldPassword: oldPass,
      newPassword: newPass
    }).subscribe({
      next: () => {
        this.isLoading = false;
        this.successMessage = 'Changed password successfully! Going back to profile...';
        
        // Reset form
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmNewPassword = '';

        // Tự động chuyển trang sau 1.8 giây
        setTimeout(() => {
          this.router.navigate(['/profile']);
        }, 1000);
      },
      error: (err) => {
        this.isLoading = false;

        let msg = 'Changed password failed!!! Please try again.';

        if (err.status === 400) {
          const backendErr = err.error;
          if (backendErr?.error?.toLowerCase().includes('wrong') || backendErr?.message?.toLowerCase().includes('wrong')) {
            msg = 'Password is not correct.Please try again.';
          } else if (typeof backendErr === 'string') {
            msg = backendErr;
          } else if (backendErr?.message) {
            msg = backendErr.message;
          } else {
            msg = 'Current password is not correct.';
          }
        } else if (err.status === 401) {
          msg = 'Your login session has expired. Please log in again.';
          this.auth.logout();
          setTimeout(() => this.router.navigate(['/login']), 2000);
        } else if (err.status === 0) {
          msg = 'Do not connect to sever. Please check internet.';
        }

        this.errorMessage = msg;
      }
    });
  }

  get isFormValid(): boolean {
    const old = this.currentPassword.trim();
    const nw = this.newPassword.trim();
    const cf = this.confirmNewPassword.trim();
    return !!old && !!nw && !!cf && nw === cf && nw.length >= 6;
  }
}