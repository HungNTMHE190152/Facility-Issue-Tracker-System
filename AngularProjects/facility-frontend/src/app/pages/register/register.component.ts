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
    otp: ''
  };

  errorMessage: string = '';
  isLoading: boolean = false;
  isSendingOtp: boolean = false;
  isVerifyingOtp: boolean = false;
  otpSent: boolean = false;
  otpVerified: boolean = false;
  otpCooldownSeconds: number = 0;
  private otpCooldownHandle: ReturnType<typeof setInterval> | null = null;

  constructor(
    private authService: AuthService,
    private router: Router,
    private notificationService: NotificationService
  ) { }

  private validateEmailOnly(): boolean {
    if (!this.user.email || !this.user.email.trim()) {
      this.notificationService.error('Email address is required.');
      return false;
    }

    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,10}$/;
    if (!emailPattern.test(this.user.email.trim())) {
      this.notificationService.error('Invalid email format (e.g., user@domain.com).');
      return false;
    }

    return true;
  }

  sendOtp(): void {
    if (!this.validateEmailOnly()) return;
    if (this.isSendingOtp || this.otpCooldownSeconds > 0) return;

    this.isSendingOtp = true;
    this.otpVerified = false;
    this.user.otp = '';
    this.authService.sendRegisterOtp(this.user.email.trim()).subscribe({
      next: () => {
        this.isSendingOtp = false;
        this.otpSent = true;
        this.notificationService.success('OTP has been sent to your email.');
        this.startOtpCooldown();
      },
      error: (err) => {
        this.isSendingOtp = false;
        const msg = err?.error?.message || err?.error || 'Failed to send OTP.';
        this.notificationService.error(msg);
      }
    });
  }

  private startOtpCooldown(): void {
    if (this.otpCooldownHandle) {
      clearInterval(this.otpCooldownHandle);
      this.otpCooldownHandle = null;
    }

    this.otpCooldownSeconds = 60;
    this.otpCooldownHandle = setInterval(() => {
      this.otpCooldownSeconds -= 1;
      if (this.otpCooldownSeconds <= 0) {
        this.otpCooldownSeconds = 0;
        if (this.otpCooldownHandle) {
          clearInterval(this.otpCooldownHandle);
          this.otpCooldownHandle = null;
        }
      }
    }, 1000);
  }

  get sendOtpButtonText(): string {
    if (this.isSendingOtp) return 'Sending OTP...';
    if (this.otpCooldownSeconds > 0) return `Resend OTP in ${this.otpCooldownSeconds}s`;
    return this.otpSent ? 'Resend OTP' : 'Send OTP';
  }

  verifyOtp(): void {
    if (!this.user.otp || !this.user.otp.trim()) {
      this.notificationService.error('Please enter OTP.');
      return;
    }

    const otpTrimmed = this.user.otp.trim();
    if (!/^\d{6}$/.test(otpTrimmed)) {
      this.notificationService.error('OTP must be 6 digits.');
      return;
    }

    this.isVerifyingOtp = true;
    this.authService.verifyRegisterOtp(this.user.email.trim(), otpTrimmed).subscribe({
      next: () => {
        this.isVerifyingOtp = false;
        this.otpVerified = true;
        this.notificationService.success('OTP verified successfully.');
      },
      error: (err) => {
        this.isVerifyingOtp = false;
        const msg = err?.error?.message || 'OTP verification failed. Please try again.';
        this.notificationService.error(msg);
      }
    });
  }

  onSubmit() {
    this.errorMessage = '';

    if (!this.user.fullName || !this.user.fullName.trim()) {
      this.notificationService.error('Full Name is required.');
      return;
    }

    if (this.user.fullName.trim().length > 30) {
      this.notificationService.error(`Full Name is too long (${this.user.fullName.trim().length}/30).`);
      return;
    }

    if (!this.validateEmailOnly()) {
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

    if (!this.otpVerified) {
      this.notificationService.error('Please verify your email with OTP first.');
      return;
    }

    this.isLoading = true;

    const data = {
      fullName: this.user.fullName.trim(),
      email: this.user.email.trim(),
      password: this.user.password.trim(),
      otp: this.user.otp.trim()
    };

    this.authService.register(data).subscribe({
      next: () => {
        this.notificationService.success('Register successfully');
        this.isLoading = false;
        this.router.navigate(['/login'], { queryParams: { email: this.user.email, password: this.user.password } });
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err?.error?.message || err.error || 'Register failed!!!';
        this.notificationService.error(this.errorMessage);
        this.otpVerified = false;
      }
    });
  }
}