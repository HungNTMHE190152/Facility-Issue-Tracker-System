import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.services';

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
  successMessage = '';
  editData: any = {
    fullName: ''
  };

  constructor(private auth: AuthService, private router: Router) { }

  ngOnInit() {
    this.auth.getProfile().subscribe({
      next: (res) => {
        this.user = res;
        this.editData = {
          fullName: res.fullName
        };
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error in getting profile:', err);
        this.errorMessage = 'Do  not download information of user.';
        this.isLoading = false;
        if (err.status === 401) {
          this.auth.logout();
          this.router.navigate(['/login']);
        }
      }
    });
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
  }

  saveProfile() {
    this.isSaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.auth.updateProfile(this.editData).subscribe({
      next: (res) => {
        this.user.fullName = this.editData.fullName;
        this.isEditing = false;
        this.isSaving = false;
        this.successMessage = 'Update profile successfully!';

        // Sử dụng hàm an toàn mới thêm
        this.auth.updateUserName(this.user.fullName);

        setTimeout(() => {
          this.successMessage = '';
        }, 3000);
      },
      error: (err) => {
        console.error('Error update profile:', err);
        this.errorMessage = 'Can not update profile.';
        this.isSaving = false;
      }
    });
  }
}
