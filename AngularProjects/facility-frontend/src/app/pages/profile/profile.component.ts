import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.services';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent implements OnInit {
  user: any = null;
  isLoading = true;
  errorMessage = '';
  isEditing = false;
  isSaving = false;
  isSaved = false;
  successMessage = '';
  editData: any = {
    fullName: ''
  };

  constructor(
    private auth: AuthService,
    private router: Router,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.loadProfile();
  }

  loadProfile() {
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.detectChanges(); // Ensure spinner shows immediately

    this.auth.getProfile().subscribe({
      next: (res) => {
        this.user = res;
        this.editData = {
          fullName: res.fullName || ''
        };
        this.isLoading = false;
        this.cdr.detectChanges();
        console.log('[Profile] Loaded user:', res);
      },
      error: (err) => {
        console.error('Error in getting profile:', err);
        this.isLoading = false;
        this.errorMessage = 'Could not load profile information.';
        this.cdr.detectChanges();
        if (err.status === 401) {
          this.auth.logout();
          this.router.navigate(['/login']);
        }
      }
    });
  }

  getInitials(fullName: string): string {
    if (!fullName) return 'U';
    const names = fullName.trim().split(' ');
    if (names.length >= 2) {
      return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }
    return names[0][0].toUpperCase();
  }

  toggleEdit() {
    this.isEditing = !this.isEditing;
    if (!this.isEditing && this.user) {
      this.editData = {
        fullName: this.user.fullName
      };
      this.successMessage = '';
      this.errorMessage = '';
    }
    this.cdr.detectChanges();
  }

  saveProfile() {
    // 1. Hiển thị thông báo thành công và trạng thái 'Saved' ngay lập tức
    this.isSaving = false;
    this.isSaved = true;
    this.notificationService.success('Update successfully!');
    this.cdr.detectChanges();

    // 2. Cập nhật dữ liệu ở local (Optimistic Update)
    const oldName = this.user.fullName;
    this.user.fullName = this.editData.fullName;
    this.auth.updateUserName(this.user.fullName);

    // 3. Gọi API ngầm trong lúc người dùng đang xem thông báo thành công
    this.auth.updateProfile(this.editData).subscribe({
      next: (res) => {
        // Sau 1.5 giây thì tự động đóng chế độ chỉnh sửa
        setTimeout(() => {
          this.isEditing = false;
          this.isSaved = false;
          this.successMessage = '';
          this.cdr.detectChanges();
        }, 1500);
      },
      error: (err) => {
        console.error('Error update profile:', err);
        this.notificationService.error('Can not update profile.');
        // Rollback nếu có lỗi
        this.user.fullName = oldName;
        this.auth.updateUserName(oldName);
        this.isSaved = false;
        this.successMessage = '';
        this.cdr.detectChanges();
      }
    });
  }
}
