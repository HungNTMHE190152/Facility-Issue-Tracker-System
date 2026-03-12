import { AfterViewInit, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Action } from 'rxjs/internal/scheduler/Action';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { TicketService } from '../../services/ticket.service';
import { AuthService } from '../../services/auth.services';
import { CategoryOption, MyTicketFilters, MyTicketItem } from '../../models/ticket.models';

@Component({
  selector: 'app-my-tickets',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './my-tickets.component.html',
  styleUrl: './my-tickets.component.css'
})
export class MyTicketsComponent implements OnInit, AfterViewInit, OnDestroy {
  tickets: MyTicketItem[] = [];
  categories: CategoryOption[] = [];
  loading = false;
  hasLoaded = false;
  currentPage = 1;
  readonly pageSize = 6;
  popupVisible = false;
  popupTitle = '';
  popupMessage = '';
  popupType: 'success' | 'error' | 'warning' | 'confirm' = 'success';
  private popupConfirmAction?: () => void;
  private loadTicketsSub?: Subscription;
  private timerInterval: any;

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
  currentDetail: MyTicketItem | null = null;
  editData: any = null;
  ticketToDelete: MyTicketItem | null = null;
  alertMessage = '';
  isError = false;
  userRole = '';

  constructor(
    private ticketService: TicketService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    this.userRole = this.authService.getCurrentUserRole();
    this.startCountdownTimer();
    this.loadCategories();

    // Handle query parameters for deep linking (e.g. from Dashboard)
    const sub = this.route.queryParams.subscribe(params => {
      if (params['status']) this.filters.status = params['status'];
      if (params['priority']) this.filters.priority = params['priority'] ? +params['priority'] : null;
      if (params['categoryId']) this.filters.categoryId = params['categoryId'] ? +params['categoryId'] : null;
      if (params['search']) this.filters.search = params['search'];

      this.loadTickets();
    });
    this.loadTicketsSub = sub;
  }

  ngAfterViewInit(): void {
    // Already handled by ngOnInit queryParams subscription
  }

  ngOnDestroy(): void {
    this.loadTicketsSub?.unsubscribe();
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
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
          this.tickets = [...res];
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
    if (text.length <= limit) return text;
    return text.substring(0, limit) + '...';
  }

  // Countdown Timer Logic (Synced with Ticket Management)
  startCountdownTimer(): void {
    this.timerInterval = setInterval(() => {
      this.updateCountdowns();
    }, 1000);
  }

  updateCountdowns(): void {
    const now = new Date().getTime();
    let changed = false;

    if (this.tickets && this.tickets.length > 0) {
      this.tickets.forEach(t => {
        if (this.calculateTimeLeft(t, now)) changed = true;
      });
    }

    if (this.currentDetail) {
      if (this.calculateTimeLeft(this.currentDetail, now)) changed = true;
    }

    if (changed) {
      this.cdr.detectChanges();
    }
  }

  calculateTimeLeft(ticket: any, now: number): boolean {
    if ((ticket.status !== 'ASSIGNED' && ticket.status !== 'IN_PROGRESS') || !ticket.assignedAt) {
      if (ticket.timeLeftStr) {
        ticket.timeLeftStr = null;
        ticket.isOverdue = false;
        return true;
      }
      return false;
    }

    let dateStr = ticket.assignedAt;
    if (dateStr.endsWith('Z')) dateStr = dateStr.slice(0, -1);
    const assignedTime = new Date(dateStr).getTime();

    let hoursAllowed = 36;
    if (ticket.status === 'ASSIGNED') {
      hoursAllowed = 3;
    } else if (ticket.priority === 3) hoursAllowed = 12;
    else if (ticket.priority === 2) hoursAllowed = 24;

    const deadline = assignedTime + (hoursAllowed * 60 * 60 * 1000);
    const diff = deadline - now;
    let oldStr = ticket.timeLeftStr;

    if (diff <= 0) {
      ticket.isOverdue = true;
      ticket.timeLeftStr = 'OVERDUE';
    } else {
      ticket.isOverdue = false;
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      ticket.timeLeftStr = `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
    }

    return oldStr !== ticket.timeLeftStr;
  }

  acceptTicket(ticket: MyTicketItem): void {
    this.loading = true;
    const updateData = {
      ticketId: ticket.ticketId,
      title: ticket.title,
      description: ticket.description,
      location: ticket.location,
      categoryId: ticket.categoryId,
      status: 'IN_PROGRESS'
    };

    this.ticketService.updateTicket(ticket.ticketId, updateData as any).subscribe({
      next: () => {
        this.showPopup('Success', 'Phòng kỹ thuật đã tiếp nhận yêu cầu!', 'success');
        this.loadTickets();
      },
      error: (err) => {
        this.showPopup('Error', err?.error?.message || 'Không thể tiếp nhận vé', 'error');
        this.loading = false;
      }
    });
  }

  openViewModal(ticket: MyTicketItem): void {
    this.currentDetail = ticket;
    this.showViewModal = true;
  }

  openEditModal(ticket: MyTicketItem): void {
    this.editData = { ...ticket };
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
    this.currentDetail = null;
    this.editData = null;
    this.ticketToDelete = null;
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

  isEditable(ticket: MyTicketItem): boolean {
    if (!ticket) return false;
    const role = this.authService.getCurrentUserRole();
    const status = ticket.status?.toUpperCase();

    // CLOSED tickets are never editable
    if (status === 'CLOSED') return false;

    // Reporters can only edit OPEN tickets
    if (role === 'Reporter') {
      return status === 'OPEN';
    }

    // Others (Dispatcher, Technician) can edit anything not CLOSED
    return true;
  }

  editTicket(ticketId: number): void {
    this.router.navigate(['/tickets/edit', ticketId]);
  }

  deleteTicket(ticket: MyTicketItem): void {
    if (!this.isEditable(ticket)) {
      const role = this.authService.getCurrentUserRole();
      if (role === 'Reporter' && ticket.status?.toUpperCase() !== 'OPEN') {
        this.showPopup('Permission Denied', 'Reporters can only delete tickets with OPEN status.', 'warning');
      } else {
        this.showPopup('Warning', 'Cannot delete a closed ticket', 'warning');
      }
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
