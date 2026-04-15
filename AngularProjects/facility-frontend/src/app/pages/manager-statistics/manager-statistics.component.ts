import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TicketService } from '../../services/ticket.service';
import { PieChartComponent } from '../../shared/components/charts/pie-chart/pie-chart.component';
import { LineChartComponent } from '../../shared/components/charts/line-chart/line-chart.component';
import { TopbarActionsComponent } from '../../shared/components/topbar-actions/topbar-actions.component';

@Component({
  selector: 'app-manager-statistics',
  standalone: true,
  imports: [CommonModule, RouterModule, PieChartComponent, LineChartComponent, TopbarActionsComponent],
  templateUrl: './manager-statistics.component.html',
  styleUrl: './manager-statistics.component.css'
})
export class ManagerStatisticsComponent implements OnInit {
  loading = false;
  error = '';
  pieChartData: Array<{ name: string; value: number }> = [];
  lineChartData: Array<{ month: number; count: number }> = [];
  leaderboard: Array<{ fullName: string; resolvedCount: number; averageRating: number }> = [];
  totalTickets = 0;
  totalResolved = 0;
  totalClosed = 0;
  averageRating = 0;
  topTechnician = 'N/A';

  constructor(
    private ticketService: TicketService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const token = localStorage.getItem('token');
    if (!token) {
      this.router.navigate(['/login']);
      return;
    }

    this.loadStats();
  }

  refresh(): void {
    this.loadStats();
  }

  private loadStats(): void {
    this.loading = true;
    this.error = '';
    this.cdr.detectChanges();

    this.ticketService.getDashboardStats().subscribe({
      next: (res: any) => {
        this.pieChartData = (res?.pieChartData ?? []).map((x: any) => ({
          name: x?.name ?? x?.Name ?? '',
          value: Number(x?.value ?? x?.Value ?? 0) || 0
        }));

        this.lineChartData = (res?.lineChartData ?? []).map((x: any) => ({
          month: Number(x?.month ?? x?.Month ?? 0) || 0,
          count: Number(x?.count ?? x?.Count ?? 0) || 0
        }));

        this.leaderboard = (res?.leaderboard ?? []).map((x: any) => ({
          fullName: x?.fullName ?? x?.FullName ?? x?.full_name ?? '',
          resolvedCount: Number(x?.resolvedCount ?? x?.ResolvedCount ?? x?.resolved_count ?? 0) || 0,
          averageRating: Number(x?.averageRating ?? x?.AverageRating ?? x?.average_rating ?? 0) || 0
        }));

        this.totalTickets = this.pieChartData.reduce((sum, item) => sum + (item.value || 0), 0);
        this.totalResolved = this.pieChartData
          .filter(item => /resolved/i.test(item.name))
          .reduce((sum, item) => sum + (item.value || 0), 0);
        this.totalClosed = this.pieChartData
          .filter(item => /closed/i.test(item.name))
          .reduce((sum, item) => sum + (item.value || 0), 0);

        if (this.leaderboard.length > 0) {
          const top = [...this.leaderboard].sort((a, b) => {
            if (b.resolvedCount !== a.resolvedCount) {
              return b.resolvedCount - a.resolvedCount;
            }
            return b.averageRating - a.averageRating;
          })[0];
          this.topTechnician = top ? top.fullName : 'N/A';
          const ratingSum = this.leaderboard.reduce((sum, item) => sum + (item.averageRating || 0), 0);
          this.averageRating = Number((ratingSum / this.leaderboard.length).toFixed(1));
        } else {
          this.topTechnician = 'N/A';
          this.averageRating = 0;
        }

        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        if (err?.status === 401) {
          this.router.navigate(['/login']);
          return;
        }
        this.error = err?.error?.message || err?.error || 'Khong the tai dashboard thong ke';
        this.loading = false;
        this.cdr.detectChanges();
      },
      complete: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }
}
