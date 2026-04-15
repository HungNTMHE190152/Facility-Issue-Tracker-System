import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.services';
import { TopbarActionsComponent } from '../../shared/components/topbar-actions/topbar-actions.component';

@Component({
  selector: 'app-dispatcher-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, TopbarActionsComponent],
  templateUrl: './dispatcher-dashboard.component.html',
  styleUrl: './dispatcher-dashboard.component.css'
})
export class DispatcherDashboardComponent implements OnInit {
  userName = '';

  constructor(
    private auth: AuthService,
    private router: Router
  ) {
    this.userName = this.auth.getCurrentUserName();
  }

  ngOnInit(): void {
    const token = localStorage.getItem('token');
    if (!token) {
      this.logout();
    }
  }

  goHome(): void {
    this.router.navigate(['/']);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
