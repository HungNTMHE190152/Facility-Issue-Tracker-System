import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.services';
import { NotificationService } from '../../services/notification.service';

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
  isSaved = false;

  constructor(
    private auth: AuthService,
    private router: Router,
    private notificationService: NotificationService
  ) { }

  onSubmit() {
    this.errorMessage = '';
    this.successMessage = '';

    const oldPass = this.currentPassword.trim();
    const newPass = this.newPassword.trim();
    const confirmPass = this.confirmNewPassword.trim();

    // Validate client-side
    if (!oldPass) {
      this.notificationService.warning('Please enter your current password');
      return;
    }
    if (!newPass) {
      this.notificationService.warning('Please enter a new password');
      return;
    }
    if (!confirmPass) {
      this.notificationService.warning('Please confirm your new password');
      return;
    }
    if (newPass !== confirmPass) {
      this.notificationService.error('New password and confirm password do not match!!!');
      return;
    }
    if (newPass.length < 6) {
      this.notificationService.warning('Password must be at least 6 characters!!!');
      return;
    }

    // 1. Phản hồi tức thì (Optimistic UI)
    this.isSaved = true;
    this.notificationService.success('Update successfully!');

    // 2. Gọi API ngầm (Background call)
    this.auth.changePassword({
      oldPassword: oldPass,
      newPassword: newPass
    }).subscribe({
      next: () => {
        console.log('Password updated in background');
      },
      error: (err) => {
        console.error('Background password update failed:', err);
      }
    });

    // 3. Điều hướng ngay lập tức (với độ trễ cực ngắn để thấy hiệu ứng nút)
    setTimeout(() => {
      this.currentPassword = '';
      this.newPassword = '';
      this.confirmNewPassword = '';
      this.router.navigate(['/profile']);
    }, 500);
  }

  get isFormValid(): boolean {
    const old = this.currentPassword.trim();
    const nw = this.newPassword.trim();
    const cf = this.confirmNewPassword.trim();
    return !!old && !!nw && !!cf && nw === cf && nw.length >= 6;
  }
}