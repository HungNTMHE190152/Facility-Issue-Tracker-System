import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.services';
import { TicketService } from '../../services/ticket.service';
import { NotificationService } from '../../services/notification.service';
import { Subscription, interval, of } from 'rxjs';
import { TopbarActionsComponent } from '../../shared/components/topbar-actions/topbar-actions.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule, TopbarActionsComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit, OnDestroy {

  userName: string = 'Guest';
  userRole: string = '';
  isLoggedIn: boolean = false;

  recentTickets: any[] = [];
  notifications: any[] = [];
  unreadCount: number = 0;
  showNotificationsPanel: boolean = false;
  lastNotificationMaxChangedAtMs: number = 0;
  private pollIntervalMs: number = 30000;

  // Review Modal State
  showReviewModal: boolean = false;
  reviewTicketId: number | null = null;
  reviewRating: number = 5;
  hoverRating: number = 0;
  reviewComment: string = '';
  loading: boolean = false;

  private subs: Subscription = new Subscription();
  private pollingSub: Subscription | null = null;

  constructor(
    private auth: AuthService,
    private router: Router,
    private ticketService: TicketService,
    private notificationService: NotificationService
  ) { }

  ngOnInit() {
    // Read initial values synchronously from AuthService (already loaded from localStorage)
    this.isLoggedIn = this.auth.isAuthenticated();
    this.userRole = this.auth.getCurrentUserRole();
    this.userName = this.auth.getCurrentUserName();

    // Start polling if already logged in (page refresh case)
    if (this.isLoggedIn) {
      this.startPolling();
    }

    // Subscribe to future changes (login/logout events)
    this.subs.add(
      this.auth.isLoggedIn$.subscribe(loggedIn => {
        const wasLoggedIn = this.isLoggedIn;
        this.isLoggedIn = loggedIn;
        if (loggedIn && !wasLoggedIn) {
          // Fresh login: role already set by AuthService before this fires
          this.userRole = this.auth.getCurrentUserRole();
          this.startPolling();
        } else if (!loggedIn) {
          this.stopPolling();
          this.notifications = [];
          this.recentTickets = [];
        }
      })
    );

    this.subs.add(
      this.auth.userName$.subscribe(name => {
        this.userName = name || 'User';
      })
    );

    this.subs.add(
      this.auth.userRole$.subscribe(role => {
        this.userRole = role || '';
      })
    );
  }

  startPolling(): void {
    this.stopPolling(); // Prevent duplicate polling
    // Fetch data immediately on first load
    this.getDashboardData().subscribe({
      next: (res: any) => this.handleDashboardResponse(res),
      error: (err) => console.error('Initial fetch error', err)
    });
    // Then set up polling interval
    const pollSub = interval(this.pollIntervalMs)
      .subscribe({
        next: () => {
          this.getDashboardData().subscribe({
            next: (res: any) => this.handleDashboardResponse(res),
            error: (err) => console.error('Polling error', err)
          });
        }
      });
    this.pollingSub = pollSub;
    this.subs.add(pollSub);
  }

  stopPolling(): void {
    if (this.pollingSub) {
      this.pollingSub.unsubscribe();
      this.pollingSub = null;
    }
  }

  refreshDashboard(): void {
    this.getDashboardData().subscribe({
      next: (res: any) => this.handleDashboardResponse(res),
      error: (err) => console.error('Manual refresh error', err)
    });
  }

  private getDashboardData() {
    // Use getCurrentUserRole() for synchronous, current role value
    const currentRole = this.auth.getCurrentUserRole().toLowerCase();
    if (this.isLoggedIn && currentRole === 'reporter') {
      console.log('[Home] Fetching reporter dashboard...');
      return this.ticketService.getReporterDashboard();
    }
    console.log('[Home] Skipping dashboard fetch. isLoggedIn:', this.isLoggedIn, 'role:', currentRole);
    return of(null);
  }

  private handleDashboardResponse(res: any): void {
    if (!res) return;
    console.log('[Home] Dashboard response:', res);
    this.recentTickets = res.recentTickets || [];
    const newNotifs = res.notifications || [];
    console.log('[Home] Notifications from API:', newNotifs.length, newNotifs);
    this.processNotifications(newNotifs);
  }

  processNotifications(newNotifs: any[]): void {
    const currentMax = this.getMaxChangedAtMs(newNotifs);
    if (this.lastNotificationMaxChangedAtMs > 0 && currentMax > this.lastNotificationMaxChangedAtMs) {
      const newCount = newNotifs.filter(n => this.toMs(n.changedAt) > this.lastNotificationMaxChangedAtMs).length;
      if (newCount > 0) {
        this.notificationService.info(`Bạn có ${newCount} thông báo mới.`);
      }
    }
    this.notifications = newNotifs;
    this.lastNotificationMaxChangedAtMs = Math.max(this.lastNotificationMaxChangedAtMs, currentMax);
    this.unreadCount = this.notifications.length; // Simplified unread logic for now
  }

  private getMaxChangedAtMs(notifs: any[]): number {
    if (!notifs.length) return 0;
    return Math.max(...notifs.map(n => this.toMs(n.changedAt)));
  }

  private toMs(dateStr: any): number {
    return dateStr ? new Date(dateStr).getTime() : 0;
  }

  toggleNotificationsPanel(): void {
    this.showNotificationsPanel = !this.showNotificationsPanel;
    if (this.showNotificationsPanel) {
      this.unreadCount = 0;
    }
  }

  closeNotificationsPanel(): void {
    this.showNotificationsPanel = false;
  }

  markAllNotificationsAsRead(): void {
    this.unreadCount = 0;
    this.closeNotificationsPanel();
  }

  statusClass(status: string): string {
    const s = (status ?? '').toUpperCase();
    if (s === 'OPEN') return 'st-open';
    if (s === 'ASSIGNED') return 'st-assigned';
    if (s === 'IN_PROGRESS') return 'st-progress';
    if (s === 'RESOLVED') return 'st-resolved';
    if (s === 'CLOSED') return 'st-closed';
    return '';
  }

  openReviewModal(ticketId: number): void {
    this.reviewTicketId = ticketId;
    this.reviewRating = 5;
    this.reviewComment = '';
    this.showReviewModal = true;
    this.closeNotificationsPanel();
  }

  closeReviewModal(): void {
    this.showReviewModal = false;
    this.reviewTicketId = null;
  }

  setRating(val: number): void {
    this.reviewRating = val;
  }

  setHover(val: number): void {
    this.hoverRating = val;
  }

  submitReviewClose(): void {
    if (!this.reviewTicketId) return;
    
    this.loading = true;
    this.ticketService.closeTicketWithReview(this.reviewTicketId, {
      rating: this.reviewRating,
      comment: this.reviewComment?.trim() || null
    }).subscribe({
      next: () => {
        this.notificationService.success('Cảm ơn bạn đã đánh giá!');
        this.closeReviewModal();
        this.refreshDashboard(); // Refresh data
        this.loading = false;
      },
      error: (err) => {
        this.notificationService.error(err?.error?.message || 'Có lỗi xảy ra khi đóng ticket');
        this.loading = false;
      }
    });
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
    this.stopPolling(); // Ensure polling is stopped on component destruction
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}