import { AfterViewInit, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { TicketService } from '../../services/ticket.service';
import { CategoryOption, MyTicketFilters, MyTicketItem } from '../../models/ticket.models';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-my-tickets',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './my-tickets.component.html',
  styleUrl: './my-tickets.component.css'
})
export class MyTicketsComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly apiBaseUrl = environment.apiUrl;
  tickets: MyTicketItem[] = [];
  categories: CategoryOption[] = [];
  loading = false;
  hasLoaded = false;
  currentPage = 1;
  readonly pageSize = 5;
  popupVisible = false;
  popupTitle = '';
  popupMessage = '';
  popupType: 'success' | 'error' | 'warning' | 'confirm' = 'success';
  private popupConfirmAction?: () => void;
  private loadTicketsSub?: Subscription;

  filters: MyTicketFilters = {
    search: '',
    status: '',
    priority: null,
    categoryId: null
  };

  // Modal states
  showViewModal = false;
  showEditModal = false;
  showDeleteModal = false;
  showReviewModal = false;
  currentDetail: MyTicketItem | null = null;
  editData: any = null;
  ticketToDelete: MyTicketItem | null = null;
  reviewTicketId: number | null = null;
  reviewRating = 5;
  reviewComment = '';
  alertMessage = '';
  isError = false;
  editSelectedImageName = '';
  lightboxSrc: string | null = null;

  openLightbox(src: string): void {
    this.lightboxSrc = src;
  }

  closeLightbox(): void {
    this.lightboxSrc = null;
  }

  private readonly maxImageBytes = 2 * 1024 * 1024;
  private readonly targetImageDataUrlLength = 1_200_000;

  constructor(
    private ticketService: TicketService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadCategories();
  }

  ngAfterViewInit(): void {
    this.loadTickets();
  }

  ngOnDestroy(): void {
    this.loadTicketsSub?.unsubscribe();
  }

  loadCategories(): void {
    this.ticketService.getCategories().subscribe({
      next: (res) => {
        this.categories = res;
      },
      error: () => {
        this.categories = [];
      }
    });
  }

  showPopup(
    title: string,
    message: string,
    type: 'success' | 'error' | 'warning' | 'confirm',
    confirmAction?: () => void
  ): void {
    this.popupTitle = title;
    this.popupMessage = message;
    this.popupType = type;
    this.popupConfirmAction = confirmAction;
    this.popupVisible = true;
  }

  closePopup(): void {
    this.popupVisible = false;
    this.popupConfirmAction = undefined;
  }

  confirmPopup(): void {
    const callback = this.popupConfirmAction;
    this.popupVisible = false;
    this.popupConfirmAction = undefined;
    if (callback) {
      callback();
    }
  }

  loadTickets(): void {
    this.loadTicketsSub?.unsubscribe();
    this.loading = true;

    this.loadTicketsSub = this.ticketService.getMyTickets(this.filters)
      .pipe(finalize(() => {
        this.loading = false;
        this.hasLoaded = true;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (res) => {
          this.tickets = (res ?? []).map(ticket => ({
            ...ticket,
            location: this.getLocationValue(ticket),
            imageBefore: this.getImagePath(ticket, 'imageBefore'),
            imageAfter: this.getImagePath(ticket, 'imageAfter')
          }));
          this.currentPage = 1;
          this.cdr.detectChanges();
        },
        error: (err) => {
          if (err?.status === 401) {
            this.showPopup('Session expired', 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.', 'warning');
            return;
          }

          this.showPopup('Error', err?.error?.message || err?.error || 'Cannot load tickets', 'error');
        }
      });
  }

  search(): void {
    this.loadTickets();
  }

  onFilterChanged(): void {
    this.loadTickets();
  }

  resetFilters(): void {
    this.filters = {
      search: '',
      status: '',
      priority: null,
      categoryId: null
    };
    this.loadTickets();
  }

  getPriorityLabel(priority?: number | null): string {
    if (priority === 1) return 'Low';
    if (priority === 2) return 'Medium';
    if (priority === 3) return 'High';
    return 'N/A';
  }

  truncateText(text: string | null | undefined, limit: number): string {
    if (!text) return '';
    const effectiveLimit = Math.max(limit, 40); 
    if (text.length <= effectiveLimit) return text;
    return text.substring(0, effectiveLimit) + '...';
  }

  openViewModal(ticket: MyTicketItem): void {
    this.ticketService.getTicketById(ticket.ticketId).subscribe({
      next: (detail: any) => {
        this.currentDetail = {
          ...detail,
          location: this.getLocationValue(detail),
          imageBefore: this.getImagePath(detail, 'imageBefore'),
          imageAfter: this.getImagePath(detail, 'imageAfter')
        };
        this.showViewModal = true;
      },
      error: () => this.showAlert('Cannot load ticket details', true)
    });
  }

  openEditModal(ticket: MyTicketItem): void {
    this.editData = {
      ...ticket,
      location: this.getLocationValue(ticket)
    };
    this.editSelectedImageName = this.editData.imageBefore ? 'Current image' : '';
    this.showEditModal = true;
  }

  openDeleteModal(ticket: MyTicketItem): void {
    this.ticketToDelete = ticket;
    this.showDeleteModal = true;
  }

  closeModals(): void {
    this.showViewModal = false;
    this.showEditModal = false;
    this.showDeleteModal = false;
    this.showReviewModal = false;
    this.currentDetail = null;
    this.editData = null;
    this.ticketToDelete = null;
    this.reviewTicketId = null;
    this.reviewRating = 5;
    this.reviewComment = '';
    this.editSelectedImageName = '';
  }

  openReviewModal(ticket: MyTicketItem): void {
    this.reviewTicketId = ticket.ticketId;
    this.reviewRating = 5;
    this.reviewComment = '';
    this.showReviewModal = true;
  }

  submitReviewClose(): void {
    if (!this.reviewTicketId) return;
    if (this.reviewRating < 1 || this.reviewRating > 5) {
      this.showAlert('Rating must be from 1 to 5', true);
      return;
    }

    this.loading = true;
    this.ticketService.closeTicketWithReview(this.reviewTicketId, {
      rating: this.reviewRating,
      comment: this.reviewComment?.trim() || null
    }).subscribe({
      next: () => {
        this.showAlert('Ticket closed and review saved', false);
        this.closeModals();
        this.loadTickets();
      },
      error: (err) => {
        this.showAlert(err?.error?.message || err?.error || 'Failed to close ticket', true);
        this.loading = false;
      }
    });
  }

  submitEdit(): void {
    if (!this.editData) return;
    this.loading = true;
    this.ticketService.updateTicket(this.editData.ticketId, this.editData).subscribe({
      next: () => {
        this.showAlert('Ticket updated successfully', false);
        this.closeModals();
        this.loadTickets();
      },
      error: (err) => {
        this.showAlert(err.error?.message || 'Failed to update ticket', true);
        this.loading = false;
      }
    });
  }

  confirmDelete(): void {
    if (!this.ticketToDelete) return;
    this.loading = true;
    this.ticketService.deleteTicket(this.ticketToDelete.ticketId).subscribe({
      next: () => {
        this.showAlert('Ticket deleted successfully', false);
        this.closeModals();
        this.loadTickets();
      },
      error: (err) => {
        this.showAlert(err.error?.message || 'Failed to delete ticket', true);
        this.loading = false;
      }
    });
  }

  showAlert(msg: string, isError: boolean): void {
    this.alertMessage = msg;
    this.isError = isError;
    setTimeout(() => this.alertMessage = '', 3000);
  }

  onImageError(event: any): void {
    event.target.style.display = 'none';
  }

  async onEditImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.showAlert('Please select an image file', true);
      input.value = '';
      return;
    }
    if (file.size > this.maxImageBytes) {
      this.showAlert('Image size must be <= 2MB', true);
      input.value = '';
      return;
    }
    this.editSelectedImageName = file.name;
    try {
      this.editData.imageBefore = await this.compressImageToDataUrl(file);
      this.cdr.detectChanges();
    } catch {
      this.showAlert('Cannot process image file', true);
      this.clearEditImage(input);
    }
  }

  clearEditImage(input?: HTMLInputElement): void {
    if (this.editData) this.editData.imageBefore = null;
    this.editSelectedImageName = '';
    if (input) input.value = '';
    this.cdr.detectChanges();
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
    const ctx = canvas.getContext('2d')!;
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
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Invalid image')); };
      img.src = url;
    });
  }

  getLocationValue(ticket: any): string {
    const value = ticket?.location ?? ticket?.Location;
    if (typeof value !== 'string') return 'N/A';
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : 'N/A';
  }

  getImagePath(ticket: any, key: 'imageBefore' | 'imageAfter'): string | null {
    if (!ticket) return null;
    const camel = ticket[key];
    const pascal = ticket[key === 'imageBefore' ? 'ImageBefore' : 'ImageAfter'];
    const value = camel ?? pascal;
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  getImageUrl(path: string | null | undefined): string {
    if (!path) return '';
    if (/^data:image\//i.test(path)) return path;
    if (/^https?:\/\//i.test(path)) return path;
    return `${this.apiBaseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  isEditable(ticket: MyTicketItem): boolean {
    return ticket.status?.toUpperCase() !== 'CLOSED';
  }

  editTicket(ticketId: number): void {
    this.router.navigate(['/tickets/edit', ticketId]);
  }

  deleteTicket(ticket: MyTicketItem): void {
    if (!this.isEditable(ticket)) {
      this.showPopup('Warning', 'Cannot delete a closed ticket', 'warning');
      return;
    }

    this.showPopup('Confirm delete', `Delete ticket #${ticket.ticketId}?`, 'confirm', () => {
      this.ticketService.deleteTicket(ticket.ticketId).subscribe({
        next: () => {
          this.tickets = this.tickets.filter(x => x.ticketId !== ticket.ticketId);
          if (this.currentPage > this.totalPages) {
            this.currentPage = this.totalPages;
          }
          this.cdr.detectChanges();
          this.showPopup('Success', 'Ticket deleted successfully', 'success');
        },
        error: (err) => {
          this.showPopup('Error', err?.error?.message || err?.error || 'Delete ticket failed', 'error');
        }
      });
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.tickets.length / this.pageSize));
  }

  get pagedTickets(): MyTicketItem[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.tickets.slice(start, start + this.pageSize);
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, index) => index + 1);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) {
      return;
    }

    this.currentPage = page;
    this.cdr.detectChanges();
  }
}
