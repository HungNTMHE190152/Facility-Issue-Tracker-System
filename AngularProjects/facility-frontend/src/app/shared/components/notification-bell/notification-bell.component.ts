import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription, of } from 'rxjs';
import { catchError, finalize, timeout } from 'rxjs/operators';
import { NotificationService } from '../../../services/notification.service';
import { Notification } from '../../../models/notification.models';
import { AuthService } from '../../../services/auth.services';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './notification-bell.component.html',
  styleUrl: './notification-bell.component.css'
})
export class NotificationBellComponent implements OnInit, OnDestroy {
  notifications: Notification[] = [];
  unreadCount: number = 0;
  showNotifications: boolean = false;
  isLoggedIn: boolean = false;
  isLoadingNotifications: boolean = false;
  unreadOnly: boolean = false;
  selectedType: string = '';

  readonly typeOptions: string[] = ['sla', 'ticket_update', 'general'];
  private readonly cacheKey = 'notification_bell_cache_v1';

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
          this.loadCachedNotifications();
          this.loadUnreadCount();
          // Prefetch to reduce first-open latency.
          this.loadNotifications(false);
        }
      })
    );
  }

  loadUnreadCount() {
    this.notifyService.getUnreadCount().subscribe(count => {
      this.unreadCount = count;
    });
  }

  private refreshNotifications(): void {
    this.loadUnreadCount();
    this.loadNotifications(true);
  }

  toggleNotifications() {
    this.showNotifications = !this.showNotifications;
    if (this.showNotifications) {
      this.refreshNotifications();
    }
  }

  onFiltersChanged() {
    this.loadNotifications(true);
  }

  loadNotifications(showLoading: boolean = true) {
    const shouldBlock = showLoading && this.notifications.length === 0;
    if (shouldBlock) {
      this.isLoadingNotifications = true;
    }

    this.notifyService.getNotifications({
      unreadOnly: this.unreadOnly,
      type: this.selectedType || undefined
    }).pipe(
      timeout(5000),
      catchError(() => of(this.notifications)),
      finalize(() => {
        this.isLoadingNotifications = false;
      })
    ).subscribe({
      next: (notifs) => {
        this.notifications = notifs;
        this.saveCachedNotifications(notifs);
      },
      error: () => {
        // Keep previous notifications on transient failures.
      }
    });
  }

  private loadCachedNotifications(): void {
    try {
      const raw = localStorage.getItem(this.cacheKey);
      if (!raw) return;
      const cached = JSON.parse(raw) as Notification[];
      if (Array.isArray(cached)) {
        this.notifications = cached;
      }
    } catch {
      // Ignore malformed cache.
    }
  }

  private saveCachedNotifications(notifs: Notification[]): void {
    try {
      localStorage.setItem(this.cacheKey, JSON.stringify(notifs.slice(0, 20)));
    } catch {
      // Ignore storage quota/availability issues.
    }
  }

  markAsRead(n: Notification) {
    if (!n.isRead) {
      this.notifyService.markAsRead(n.notificationId).subscribe(() => {
        n.isRead = true;
        this.loadUnreadCount();
        if (this.unreadOnly) {
          this.loadNotifications();
        }
        this.navigateFromNotification(n);
      });
      return;
    }

    this.navigateFromNotification(n);
  }

  private navigateFromNotification(n: Notification) {
    this.showNotifications = false;
    const actionUrl = (n.actionUrl || '').trim();
    if (actionUrl.startsWith('/')) {
      this.router.navigateByUrl(actionUrl);
      return;
    }

    this.router.navigate(['/tickets/my']);
  }

  markAllAsRead() {
    this.notifyService.markAllAsRead().subscribe(() => {
      this.notifications.forEach(n => n.isRead = true);
      this.unreadCount = 0;
      this.refreshNotifications();
    });
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
  }
}
