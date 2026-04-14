import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth.services';
import { NotificationBellComponent } from '../notification-bell/notification-bell.component';

@Component({
  selector: 'app-topbar-actions',
  standalone: true,
  imports: [CommonModule, RouterModule, NotificationBellComponent],
  templateUrl: './topbar-actions.component.html',
  styleUrl: './topbar-actions.component.css'
})
export class TopbarActionsComponent {
  @Input() homeLink: string = '/';
  @Input() showHome: boolean = true;

  constructor(public auth: AuthService, private router: Router) {}

  get userName(): string {
    return this.auth.getCurrentUserName() || 'User';
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
