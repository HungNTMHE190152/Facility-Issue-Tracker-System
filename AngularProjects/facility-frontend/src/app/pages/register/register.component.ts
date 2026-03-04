import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.services';

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
    private router: Router
  ) { }

  onSubmit() {
    this.errorMessage = '';
    this.isLoading = true;

    if (!this.user.fullName.trim()) {
      this.errorMessage = 'Please enter fullName';
      this.isLoading = false;
      return;
    }

    if (this.user.password !== this.user.confirmPassword) {
      this.errorMessage = 'Password and confirm password do not match';
      this.isLoading = false;
      return;
    }

    if (this.user.password.length < 6) {
      this.errorMessage = 'Password must be at least 6 characters';
      this.isLoading = false;
      return;
    }

    const data = {
      fullName: this.user.fullName.trim(),
      email: this.user.email.trim(),
      password: this.user.password.trim()
    };

    this.authService.register(data).subscribe({
      next: () => {
        alert('Register successfully');
        this.isLoading = false;
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error || 'Register failed!!! (Email exist?)';
      }
    });
  }
}