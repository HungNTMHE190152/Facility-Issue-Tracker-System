import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.services';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent {
  user = {
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'REPORTER'
  };

  errorMessage: string = '';
  isLoading: boolean = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private notificationService: NotificationService
  ) { }

  onSubmit() {
    this.errorMessage = '';
    
    // Granular Validation
    if (!this.user.fullName || !this.user.fullName.trim()) {
      this.notificationService.error('Full Name is required.');
      return;
    }

    if (this.user.fullName.trim().length > 30) {
      this.notificationService.error(`Full Name is too long (${this.user.fullName.trim().length}/30).`);
      return;
    }

    if (!this.user.email || !this.user.email.trim()) {
      this.notificationService.error('Email address is required.');
      return;
    }

    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,10}$/;
    if (!emailPattern.test(this.user.email.trim())) {
      this.notificationService.error('Invalid email format (e.g., user@domain.com).');
      return;
    }

    if (!this.user.password || this.user.password.length < 6) {
      this.notificationService.error('Password must be at least 6 characters.');
      return;
    }

    if (this.user.password !== this.user.confirmPassword) {
      this.notificationService.error('Passwords do not match.');
      return;
    }

    this.isLoading = true;

    const data = {
      fullName: this.user.fullName.trim(),
      email: this.user.email.trim(),
      password: this.user.password.trim(),
      role: 'REPORTER' // Fixed role for registration
    };

    this.authService.register(data).subscribe({
      next: () => {
        this.notificationService.success('Register successfully');
        this.isLoading = false;
        this.router.navigate(['/login'], { queryParams: { email: this.user.email, password: this.user.password } });
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error || 'Register failed!!! (Email exist?)';
        this.notificationService.error(this.errorMessage);
      }
    });
  }
}