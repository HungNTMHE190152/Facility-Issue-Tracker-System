import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { TicketService } from '../../services/ticket.service';
import { PieChartComponent } from '../../shared/components/charts/pie-chart/pie-chart.component';
import { LineChartComponent } from '../../shared/components/charts/line-chart/line-chart.component';
import { NotificationService } from '../../services/notification.service';
import { finalize } from 'rxjs/operators';

type TechnicianPieDatum = { name: string; value: number };
type TechnicianLineDatum = { month: number; count: number };

@Component({
  selector: 'app-technician-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, PieChartComponent, LineChartComponent],
  templateUrl: './technician-dashboard.component.html',
  styleUrl: './technician-dashboard.component.css',
})
export class TechnicianDashboardComponent implements OnInit, OnDestroy {
  private subs = new Subscription();

  loading = false;
  hasLoaded = false;

  pieChartData: TechnicianPieDatum[] = [];
  lineChartData: TechnicianLineDatum[] = [];
  averageRating = 0;

  statusCounts: Array<{ status: string; count: number }> = [];
  recentTickets: Array<any> = [];
  notifications: Array<any> = [];

  showNotificationsPanel = false;
  unreadCount = 0;

  private readonly notifLastReadAtKey = 'techNotifLastReadAtMs';
  private notifLastReadAtMs = 0;
  private pollIntervalMs = 30000;
  private pollHandle: any = null;
  private lastNotificationMaxChangedAtMs = 0;

  // Resolve modal
  resolveModalVisible = false;
  resolveTicketId: number | null = null;
  resolveImageData: string | null = null;
  resolveImageName = '';
  resolveLoading = false;

  readonly maxImageBytes = 2 * 1024 * 1024;
  readonly targetImageDataUrlLength = 1_200_000;

  constructor(
    private ticketService: TicketService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.notifLastReadAtMs = Number(localStorage.getItem(this.notifLastReadAtKey) || '0') || 0;
    this.loadDashboard(true);
    this.startPolling();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
  }

  private startPolling(): void {
    if (this.pollHandle) return;
    this.pollHandle = setInterval(() => {
      // Silent polling: do not disable buttons / do not toggle initial loading spinner.
      this.loadDashboard(false);
    }, this.pollIntervalMs);
  }

  private loadDashboard(isInitialLoad: boolean): void {
    if (isInitialLoad) {
      this.loading = true;
      this.hasLoaded = false;
    }
    const sub = this.ticketService
      .getTechnicianDashboard()
      .pipe(
        finalize(() => {
          if (isInitialLoad) {
            this.loading = false;
            this.hasLoaded = true;
          }
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (res) => {
          const newNotifications = res?.notifications ?? [];
          const newMaxChangedAtMs = this.getMaxChangedAtMs(newNotifications);

          if (!isInitialLoad && newMaxChangedAtMs > this.lastNotificationMaxChangedAtMs) {
            const newCount = newNotifications.filter(
              (n: any) => this.toMs(n?.changedAt) > this.lastNotificationMaxChangedAtMs
            ).length;
            if (newCount > 0) {
              this.notificationService.info(`Bạn có ${newCount} thông báo mới.`);
            }
          }

          this.pieChartData = res?.pieChartData ?? [];
          this.lineChartData = res?.lineChartData ?? [];
          this.averageRating = res?.averageRating ?? 0;
          this.statusCounts = res?.taskProgress?.statusCounts ?? [];
          this.recentTickets = res?.taskProgress?.recentTickets ?? [];
          this.notifications = newNotifications;

          this.lastNotificationMaxChangedAtMs = Math.max(this.lastNotificationMaxChangedAtMs, newMaxChangedAtMs);
          this.updateUnreadCount();
          this.cdr.detectChanges(); // Robustness: detect inside next
        },
        error: (err) => {
          this.notificationService.error(err?.error?.message || err?.error || 'Cannot load dashboard');
          this.cdr.detectChanges();
        },
      });

    this.subs.add(sub);
  }

  private updateUnreadCount(): void {
    this.unreadCount = (this.notifications ?? []).filter(
      (n: any) => this.toMs(n?.changedAt) > this.notifLastReadAtMs
    ).length;
  }

  toggleNotificationsPanel(): void {
    this.showNotificationsPanel = !this.showNotificationsPanel;
  }

  closeNotificationsPanel(): void {
    this.showNotificationsPanel = false;
  }

  markAllNotificationsAsRead(): void {
    this.notifLastReadAtMs = Date.now();
    localStorage.setItem(this.notifLastReadAtKey, String(this.notifLastReadAtMs));
    this.updateUnreadCount();
    this.notificationService.success('All notifications marked as read.');
  }

  private toMs(value: any): number {
    if (!value) return 0;
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? 0 : ms;
  }

  private getMaxChangedAtMs(notifs: any[]): number {
    if (!notifs?.length) return 0;
    return Math.max(
      ...notifs.map((n: any) => this.toMs(n?.changedAt))
    );
  }

  // US-41 helpers: progress + time spent
  progressPercent(status: string): number {
    const idx = this.stepIndex(status);
    const maxIdx = 4; // OPEN..CLOSED => 5 steps
    return Math.round((idx / maxIdx) * 100);
  }

  timeSpentLabel(ticket: any): string | null {
    const assignedMs = this.toMs(ticket?.assignedAt);
    if (!assignedMs) return null;

    const status = (ticket?.status ?? '').toUpperCase();
    let endMs: number | null = null;

    if (status === 'CLOSED') endMs = this.toMs(ticket?.closedAt);
    else if (status === 'RESOLVED') endMs = this.toMs(ticket?.resolvedAt);
    else endMs = Date.now();

    if (!endMs) return null;
    const diff = Math.max(0, endMs - assignedMs);
    return this.formatDuration(diff);
  }

  private formatDuration(ms: number): string {
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours <= 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
  }

  countForStatus(status: string): number {
    const normalized = (status ?? '').toUpperCase();
    return this.statusCounts.find((s) => (s.status ?? '').toUpperCase() === normalized)?.count ?? 0;
  }

  statusClass(status: string): string {
    const s = (status ?? '').toUpperCase();
    if (s === 'ASSIGNED') return 'st-assigned';
    if (s === 'IN_PROGRESS') return 'st-progress';
    if (s === 'PAUSED') return 'st-paused';
    if (s === 'RESOLVED') return 'st-resolved';
    if (s === 'CLOSED') return 'st-closed';
    return 'st-open';
  }

  stepIndex(status: string): number {
    const s = (status ?? '').toUpperCase();
    const order = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
    if (s === 'PAUSED') return 2; // Keep at IN_PROGRESS highlight level
    return Math.max(0, order.indexOf(s));
  }

  openResolveModal(ticketId: number): void {
    this.resolveTicketId = ticketId;
    this.resolveModalVisible = true;
    this.resolveImageData = null;
    this.resolveImageName = '';
    this.resolveLoading = false;
  }

  onResolveImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.notificationService.warning('Please select an image file');
      input.value = '';
      return;
    }

    if (file.size > this.maxImageBytes) {
      this.notificationService.warning('Image size must be <= 2MB');
      input.value = '';
      return;
    }

    this.resolveImageName = file.name;

    // Compress for smaller payload
    this.compressImageToDataUrl(file)
      .then((dataUrl) => {
        this.resolveImageData = dataUrl;
      })
      .catch(() => {
        this.notificationService.error('Cannot process image file');
        input.value = '';
        this.resolveImageData = null;
        this.resolveImageName = '';
      });
  }

  closeResolveModal(): void {
    this.resolveModalVisible = false;
    this.resolveTicketId = null;
    this.resolveImageData = null;
    this.resolveImageName = '';
    this.resolveLoading = false;
  }

  submitResolve(): void {
    if (!this.resolveTicketId || this.resolveLoading) return;
    this.resolveLoading = true;

    const sub = this.ticketService
      .resolveTechnicianTicket(this.resolveTicketId, { imageAfter: this.resolveImageData })
      .pipe(
        finalize(() => {
          this.resolveLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: () => {
          this.notificationService.success('Ticket resolved successfully');
          this.closeResolveModal();
          this.loadDashboard(false);
        },
        error: (err) => {
          this.notificationService.error(err?.error?.message || err?.error || 'Resolve failed');
        },
      });

    this.subs.add(sub);
  }

  startTicket(ticketId: number): void {
    if (this.loading) return;
    this.loading = true;
    this.cdr.detectChanges();

    const sub = this.ticketService.startTechnicianTicket(ticketId).subscribe({
      next: () => {
        this.notificationService.success('Ticket started');
        this.loadDashboard(true);
      },
      error: (err) => {
        this.loading = false;
        this.notificationService.error(err?.error?.message || err?.error || 'Start failed');
        this.cdr.detectChanges();
      },
    });
    this.subs.add(sub);
  }

  pauseTicket(ticketId: number): void {
    if (this.loading) return;
    this.loading = true; // Provide immediate feedback
    this.cdr.detectChanges();

    const sub = this.ticketService.pauseTicket(ticketId).subscribe({
      next: () => {
        this.notificationService.info('Mission paused');
        this.loadDashboard(true); // Force full refresh
      },
      error: (err) => {
        this.loading = false;
        this.notificationService.error(err?.error?.message || err?.error || 'Pause failed');
        this.cdr.detectChanges();
      },
    });
    this.subs.add(sub);
  }

  resumeTicket(ticketId: number): void {
    if (this.loading) return;
    this.loading = true;
    this.cdr.detectChanges();

    const sub = this.ticketService.resumeTicket(ticketId).subscribe({
      next: () => {
        this.notificationService.success('Mission resumed');
        this.loadDashboard(true); // Force full refresh
      },
      error: (err) => {
        this.loading = false;
        this.notificationService.error(err?.error?.message || err?.error || 'Resume failed');
        this.cdr.detectChanges();
      },
    });
    this.subs.add(sub);
  }

  private async compressImageToDataUrl(file: File): Promise<string> {
    const img = await this.readImage(file);
    const maxDim = 1280;
    const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * ratio));
    const h = Math.max(1, Math.round(img.height * ratio));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No canvas context');

    ctx.drawImage(img, 0, 0, w, h);

    let quality = 0.86;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    while (dataUrl.length > this.targetImageDataUrlLength && quality > 0.5) {
      quality -= 0.08;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }
    return dataUrl;
  }

  private readImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Invalid image'));
      };
      img.src = url;
    });
  }

  backHome(): void {
    this.router.navigate(['/']);
  }
}

