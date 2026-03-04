import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.services';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {

  email = '';
  password = '';

  constructor(private auth: AuthService, private router: Router, private route: ActivatedRoute) { }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['email']) this.email = params['email'];
      if (params['password']) this.password = params['password'];
    });
  }

  onSubmit() {
    if (!this.email || !this.password) {
      alert('Enter email and password');
      return;
    }

    const data = {
      email: this.email.trim(),
      password: this.password.trim()
    };

    console.log('Sending login with: ', data); // debug

    this.auth.login(data).subscribe({
      next: (res) => {
        console.log('Login response from server:', res);

        // Kiểm tra xem backend có trả token không
        if (res && res.token) {
          console.log('Token saved successfully:', res.token);
          this.router.navigate(['/']); // hoặc '/profile' tùy bạn
        } else {
          alert('Login successfully but do not receive a token from the server.');
        }
      },
      error: (err) => {
        console.error('Error in login:', err);
        let msg = 'Login failed.';

        if (err.status === 401) {
          msg = 'Email or password is not correct.';
        } else if (err.status === 0) {
          msg = 'Do not connect to server.(CORS or server closed?)';
        } else if (err.error?.message) {
          msg = err.error.message;
        }

        alert(msg);
      }
    });
  }
}