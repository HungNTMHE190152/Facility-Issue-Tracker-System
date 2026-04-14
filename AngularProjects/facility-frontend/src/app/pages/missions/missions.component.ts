import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TicketService } from '../../services/ticket.service';
import { MyTicketItem, ResolveTicketRequest, TicketHistory } from '../../models/ticket.models';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-missions',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './missions.component.html',
  styleUrl: './missions.component.css'
})
export class MissionsComponent implements OnInit {
  missions: MyTicketItem[] = [];
  loading = false;
  submitting = false; 
  successMessage = '';
  errorMessage = '';

  showResolveModal = false;
  resolveData: ResolveTicketRequest = { imageAfter: null };
  currentDetail: MyTicketItem | null = null;
  
  showHistoryModal = false;
  historyRecords: TicketHistory[] = [];
  historyLoading = false;
  
  compressing = false; 
  private readonly maxImageBytes = 15 * 1024 * 1024; 
  private readonly targetImageDataUrlLength = 150_000; 

  constructor(
    private ticketService: TicketService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadMissions();
  }

  loadMissions(): void {
    this.loading = true;
    this.ticketService.getActiveMissions().subscribe({
      next: (data) => {
        this.missions = (data ?? []).sort((a, b) => {
          const pA = a.priority ?? 0;
          const pB = b.priority ?? 0;
          if (pB !== pA) return pB - pA;

          const tA = a.createdAt ? new Date(a.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
          const tB = b.createdAt ? new Date(b.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
          return tA - tB;
        });
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error fetching active missions:', err);
        this.errorMessage = 'Không thể tải nhiệm vụ. Vui lòng thử lại.';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  getPriorityLabel(priority?: number | null): string {
    if (priority === 3) return 'High';
    if (priority === 2) return 'Medium';
    if (priority === 1) return 'Low';
    return 'N/A';
  }

  approve(id: number): void {
    if (this.loading) return;
    if (!confirm('Bạn có chắc chắn muốn chấp nhận nhiệm vụ này?')) return;
    
    this.submitting = true;
    this.errorMessage = '';
    this.successMessage = '';
    
    this.ticketService.approveTicket(id).subscribe({
      next: (res) => {
        this.submitting = false;
        this.successMessage = res.message;
        this.loadMissions();
      },
      error: (err) => {
        this.submitting = false;
        console.error('Approve Error:', err);
        this.errorMessage = err?.error?.message || 'Không thể chấp nhận nhiệm vụ. Vui lòng thử lại.';
        this.cdr.detectChanges();
        setTimeout(() => this.errorMessage = '', 5000);
      }
    });
  }

  reject(id: number): void {
    if (this.submitting) return;
    if (!confirm('Bạn có chắc chắn muốn từ chối nhiệm vụ này?')) return;

    this.submitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.ticketService.rejectTicket(id).subscribe({
      next: (res) => {
        this.submitting = false;
        this.successMessage = res.message;
        this.loadMissions();
      },
      error: (err) => {
        this.submitting = false;
        console.error('Reject Error:', err);
        this.errorMessage = err?.error?.message || 'Không thể từ chối nhiệm vụ.';
        this.cdr.detectChanges();
        setTimeout(() => this.errorMessage = '', 5000);
      }
    });
  }

  startTicket(id: number): void {
    if (this.submitting) return;
    this.submitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.ticketService.startTicket(id).subscribe({
      next: (res) => {
        this.submitting = false;
        this.successMessage = res.message || 'Nhiệm vụ đã được bắt đầu!';
        this.loadMissions();
      },
      error: (err) => {
        this.submitting = false;
        console.error('Start Error:', err);
        this.errorMessage = err?.error?.message || 'Lỗi khi bắt đầu';
        this.cdr.detectChanges();
        setTimeout(() => this.errorMessage = '', 5000);
      }
    });
  }

  pauseTicket(id: number): void {
    if (this.submitting) return;
    this.submitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.ticketService.pauseTicket(id).subscribe({
      next: (res) => {
        this.submitting = false;
        this.successMessage = res.message || 'Đã tạm dừng!';
        this.loadMissions();
      },
      error: (err) => {
        this.submitting = false;
        console.error('Pause Error:', err);
        this.errorMessage = err?.error?.message || 'Lỗi khi tạm dừng';
        this.cdr.detectChanges();
        setTimeout(() => this.errorMessage = '', 5000);
      }
    });
  }

  resumeTicket(id: number): void {
    if (this.submitting) return;
    this.submitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.ticketService.resumeTicket(id).subscribe({
      next: (res) => {
        this.submitting = false;
        this.successMessage = res.message || 'Đã tiếp tục công việc!';
        this.loadMissions();
      },
      error: (err) => {
        this.submitting = false;
        console.error('Resume Error:', err);
        this.errorMessage = err?.error?.message || 'Lỗi khi tiếp tục';
        this.cdr.detectChanges();
        setTimeout(() => this.errorMessage = '', 5000);
      }
    });
  }

  openResolveModal(ticket: MyTicketItem): void {
    this.currentDetail = ticket;
    this.resolveData = { imageAfter: null };
    this.showResolveModal = true;
    this.cdr.detectChanges();
  }

  closeResolveModal(): void {
    this.showResolveModal = false;
    this.resolveData = { imageAfter: null };
  }

  async onResolveFileSelected(event: Event | any): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file hình ảnh (JPG, PNG)');
      if (input) input.value = '';
      return;
    }
    if (file.size > this.maxImageBytes) {
      alert('Kích thước ảnh phải <= 15MB');
      if (input) input.value = '';
      return;
    }

    try {
      this.compressing = true;
      this.cdr.detectChanges();
      this.resolveData.imageAfter = await this.compressImageToDataUrl(file);
      this.compressing = false;
      this.cdr.detectChanges();
    } catch (err) {
      console.error('Compression error:', err);
      this.compressing = false;
      alert('Lỗi nén ảnh, vui lòng thử lại');
      this.removeResolveImage();
    }
  }

  removeResolveImage(): void {
    this.resolveData.imageAfter = null;
    this.cdr.detectChanges();
  }

  submitResolve(): void {
    if (!this.currentDetail || this.submitting) return;
    const ticketId = this.currentDetail.ticketId;
    this.submitting = true;
    console.log('[DEBUG] Submitting Resolve for Ticket:', ticketId);
    
    this.ticketService.resolveTicket(ticketId, this.resolveData).subscribe({
      next: (res) => {
        console.log('[DEBUG] Resolve Response Success:', res);
        this.submitting = false;
        this.successMessage = 'Hoàn thành nhiệm vụ thành công!';
        this.closeResolveModal();
        this.loadMissions();
        this.cdr.detectChanges();
        setTimeout(() => this.successMessage = '', 4000);
      },
      error: (err) => {
        console.error('[DEBUG] Resolve Response Error:', err);
        this.submitting = false;
        this.errorMessage = err?.error?.message || 'Lỗi khi báo cáo hoàn thành';
        this.cdr.detectChanges();
        setTimeout(() => this.errorMessage = '', 4000);
      }
    });
  }

  private async compressImageToDataUrl(file: File): Promise<string> {
    const img = await this.readImage(file);
    const maxDim = 800; // Giảm xuống 800px để siêu nhanh
    const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * ratio));
    const h = Math.max(1, Math.round(img.height * ratio));
    
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    
    let quality = 0.6; 
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    
    while (dataUrl.length > this.targetImageDataUrlLength && quality > 0.2) {
      quality -= 0.1;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }
    return dataUrl;
  }

  private readImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Invalid image')); };
      img.src = url;
    });
  }

  openHistoryModal(ticketId: number): void {
    this.historyLoading = true;
    this.historyRecords = [];
    this.showHistoryModal = true;
    this.cdr.detectChanges();

    this.ticketService.getTicketHistory(ticketId).subscribe({
      next: (data) => {
        this.historyRecords = data;
        this.historyLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error fetching history:', err);
        this.errorMessage = 'Không thể tải lịch sử sự cố.';
        this.historyLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  closeHistoryModal(): void {
    this.showHistoryModal = false;
    this.historyRecords = [];
  }
}


