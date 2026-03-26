import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { NotificationService } from '../../../services/notification.service';
import { Notification } from '../../../models/notification.models';
import { AuthService } from '../../../services/auth.services';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './notification-bell.component.html',
  styleUrl: './notification-bell.component.css'
})
export class NotificationBellComponent implements OnInit, OnDestroy {
  notifications: Notification[] = [];
  unreadCount: number = 0;
  showNotifications: boolean = false;
  isLoggedIn: boolean = false;

  private subs: Subscription = new Subscription();

  constructor(
    private notifyService: NotificationService,
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.subs.add(
      this.auth.isLoggedIn$.subscribe(loggedIn => {
        this.isLoggedIn = loggedIn;
        if (loggedIn) {
          this.loadUnreadCount();
        }
      })
    );
  }

  loadUnreadCount() {
    this.notifyService.getUnreadCount().subscribe(count => {
      this.unreadCount = count;
    });
  }

  toggleNotifications() {
    this.showNotifications = !this.showNotifications;
    if (this.showNotifications) {
      this.loadNotifications();
    }
  }

  loadNotifications() {
    this.notifyService.getNotifications().subscribe(notifs => {
      this.notifications = notifs;
    });
  }

  markAsRead(n: Notification) {
    if (!n.isRead) {
      this.notifyService.markAsRead(n.notificationId).subscribe(() => {
        n.isRead = true;
        this.loadUnreadCount();
      });
    }
    this.showNotifications = false;
    this.router.navigate(['/tickets/my']);
  }

  markAllAsRead() {
    this.notifyService.markAllAsRead().subscribe(() => {
      this.notifications.forEach(n => n.isRead = true);
      this.unreadCount = 0;
    });
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
  }
}
