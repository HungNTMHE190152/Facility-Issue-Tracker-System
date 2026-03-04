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
      this.errorMessage = 'Vui lòng nhập mật khẩu hiện tại';
      return;
    }
    if (newPass !== confirmPass) {
      this.errorMessage = 'Mật khẩu mới và xác nhận không khớp';
      return;
    }
    if (newPass.length < 6) {
      this.errorMessage = 'Mật khẩu mới phải có ít nhất 6 ký tự';
      return;
    }

    this.isLoading = true;

    this.auth.changePassword({
      oldPassword: oldPass,
      newPassword: newPass
    }).subscribe({
      next: () => {
        this.isLoading = false;
        this.successMessage = 'Đổi mật khẩu thành công! Đang chuyển về trang cá nhân...';
        
        // Reset form
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmNewPassword = '';

        // Tự động chuyển trang sau 1.8 giây
        setTimeout(() => {
          this.router.navigate(['/profile']);
        }, 1800);
      },
      error: (err) => {
        this.isLoading = false;

        let msg = 'Đổi mật khẩu thất bại. Vui lòng thử lại.';

        if (err.status === 400) {
          const backendErr = err.error;
          if (backendErr?.error?.toLowerCase().includes('wrong') || backendErr?.message?.toLowerCase().includes('wrong')) {
            msg = 'Mật khẩu hiện tại không đúng. Vui lòng kiểm tra lại.';
          } else if (typeof backendErr === 'string') {
            msg = backendErr;
          } else if (backendErr?.message) {
            msg = backendErr.message;
          } else {
            msg = 'Mật khẩu hiện tại không đúng hoặc yêu cầu không hợp lệ.';
          }
        } else if (err.status === 401) {
          msg = 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.';
          this.auth.logout();
          setTimeout(() => this.router.navigate(['/login']), 2000);
        } else if (err.status === 0) {
          msg = 'Không kết nối được server. Vui lòng kiểm tra mạng.';
        }

        this.errorMessage = msg;
      }
    });
  }

  // Helper để kiểm tra form có hợp lệ để bật nút
  get isFormValid(): boolean {
    const old = this.currentPassword.trim();
    const nw = this.newPassword.trim();
    const cf = this.confirmNewPassword.trim();
    return !!old && !!nw && !!cf && nw === cf && nw.length >= 6;
  }
}