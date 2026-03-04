import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.services';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {

  email = '';
  password = '';

  constructor(private auth: AuthService, private router: Router) { }

  onSubmit() {
    if (!this.email || !this.password) {
      alert('Vui lòng nhập email và mật khẩu');
      return;
    }

    const data = {
      email: this.email.trim(),
      password: this.password.trim()
    };

    console.log('Đang gửi login với:', data); // debug

    this.auth.login(data).subscribe({
      next: (res) => {
        console.log('Login response từ server:', res); // ← quan trọng nhất!

        // Kiểm tra xem backend có trả token không
        if (res && res.token) {
          console.log('Token lưu thành công:', res.token);
          this.router.navigate(['/']); // hoặc '/profile' tùy bạn
        } else {
          alert('Login thành công nhưng không nhận được token từ server');
        }
      },
      error: (err) => {
        console.error('Lỗi login chi tiết:', err);
        let msg = 'Đăng nhập thất bại.';

        if (err.status === 401) {
          msg = 'Email hoặc mật khẩu không đúng';
        } else if (err.status === 0) {
          msg = 'Không kết nối được server (CORS hoặc server tắt?)';
        } else if (err.error?.message) {
          msg = err.error.message;
        }

        alert(msg);
      }
    });
  }
}