import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.services';
import { TicketService } from '../../services/ticket.service';
import { PieChartComponent } from '../../shared/components/charts/pie-chart/pie-chart.component';
import { LineChartComponent } from '../../shared/components/charts/line-chart/line-chart.component';

@Component({
  selector: 'app-dispatcher-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, PieChartComponent, LineChartComponent],
  templateUrl: './dispatcher-dashboard.component.html',
  styleUrl: './dispatcher-dashboard.component.css'
})
export class DispatcherDashboardComponent implements OnInit {
  userName = '';
  importLoading = false;
  dashboardLoading = false;
  dashboardError = '';
  pieChartData: Array<{ name: string; value: number }> = [];
  lineChartData: Array<{ month: number; count: number }> = [];
  leaderboard: Array<{ fullName: string; resolvedCount: number; averageRating: number }> = [];

  constructor(
    private auth: AuthService,
    private router: Router,
    private ticketService: TicketService
  ) {
    this.userName = this.auth.getCurrentUserName();
  }

  ngOnInit(): void {
    this.loadDashboardStats();
  }

  onExportExcel(): void {
    this.ticketService.exportTickets().subscribe({
      next: (res: any) => {
        if (res?.url) window.open(res.url, '_blank');
        else alert('Không tìm thấy đường dẫn tải file!');
      },
      error: (err) => {
        console.error(err);
        alert('Tải file thất bại!');
      }
    });
  }

  onExportResolvedExcel(): void {
    this.ticketService.exportResolvedTickets().subscribe({
      next: (res: any) => {
        if (res?.url) window.open(res.url, '_blank');
        else alert('Không tìm thấy đường dẫn file báo cáo ticket đã giải quyết!');
      },
      error: (err) => {
        console.error(err);
        alert('Xuất báo cáo ticket đã giải quyết thất bại!');
      }
    });
  }

  onExportMaterialCostExcel(): void {
    this.ticketService.exportMaterialCostReport().subscribe({
      next: (res: any) => {
        if (res?.url) window.open(res.url, '_blank');
        else alert('Không tìm thấy đường dẫn file chi phí vật liệu!');
      },
      error: (err) => {
        console.error(err);
        alert('Xuất báo cáo chi phí vật liệu thất bại!');
      }
    });
  }

  onExportMaintenanceLogExcel(): void {
    this.ticketService.exportMaintenanceLogExcel().subscribe({
      next: (res: any) => {
        if (res?.url) window.open(res.url, '_blank');
        else alert('Không tìm thấy đường dẫn file nhật ký bảo trì!');
      },
      error: (err) => {
        console.error(err);
        alert('Xuất nhật ký bảo trì thất bại!');
      }
    });
  }

  onImportSuppliesFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.importLoading = true;
    this.ticketService.importSupplies(file).subscribe({
      next: (res: any) => {
        alert(res?.message || 'Import excel success');
        input.value = '';
      },
      error: (err) => {
        console.error(err);
        alert(err?.error?.message || err?.error || 'Import excel failed');
      },
      complete: () => {
        this.importLoading = false;
      }
    });
  }

  goHome(): void {
    this.router.navigate(['/home']);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  private loadDashboardStats(): void {
    this.dashboardLoading = true;
    this.dashboardError = '';
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
      },
      error: (err) => {
        console.error(err);
        this.dashboardError = err?.error?.message || err?.error || 'Không thể tải dashboard thống kê';
        this.dashboardLoading = false;
        alert(err?.error?.message || 'Không thể tải dashboard thống kê');
      },
      complete: () => {
        this.dashboardLoading = false;
      }
    });
  }
}
