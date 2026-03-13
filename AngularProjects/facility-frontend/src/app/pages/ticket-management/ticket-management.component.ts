import { AfterViewInit, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { TicketService } from '../../services/ticket.service';
import { CategoryOption, MyTicketFilters, MyTicketItem } from '../../models/ticket.models';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-ticket-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './ticket-management.component.html',
  styleUrl: './ticket-management.component.css'
})
export class TicketManagementComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly apiBaseUrl = environment.apiUrl;
  tickets: MyTicketItem[] = [];
  categories: CategoryOption[] = [];
  loading = false;
  hasLoaded = false;
  private loadTicketsSub?: Subscription;

  filters: MyTicketFilters = {
    search: '',
    status: '',
    priority: null,
    categoryId: null
  };

  // Pagination
  currentPage: number = 1;
  pageSize: number = 10;

  get totalPages(): number {
    return Math.ceil(this.tickets.length / this.pageSize);
  }

  get paginatedTickets(): MyTicketItem[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.tickets.slice(start, start + this.pageSize);
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  constructor(
    private ticketService: TicketService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadCategories();
    this.startCountdownTimer();
  }

  ngAfterViewInit(): void {
    this.loadTickets();
  }

  ngOnDestroy(): void {
    this.loadTicketsSub?.unsubscribe();
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  timerInterval: any;

  startCountdownTimer(): void {
    this.timerInterval = setInterval(() => {
      this.updateCountdowns();
    }, 1000);
  }

  updateCountdowns(): void {
    const now = new Date().getTime();
    if (this.tickets && this.tickets.length > 0) {
      // Force UI update by triggering change detection efficiently
      let changed = false;
      this.tickets.forEach(t => {
        if (this.calculateTimeLeft(t, now)) changed = true;
      });
      if (changed) this.cdr.detectChanges();
    }
    if (this.currentDetail) {
      if (this.calculateTimeLeft(this.currentDetail, now)) {
        this.cdr.detectChanges();
      }
    }
  }

  // Returns true if strings changed to hint ChangeDetectorRef
  calculateTimeLeft(ticket: any, now: number): boolean {
    if ((ticket.status !== 'ASSIGNED' && ticket.status !== 'IN_PROGRESS') || !ticket.assignedAt) {
      if (ticket.timeLeftStr) {
        ticket.timeLeftStr = null;
        ticket.isOverdue = false;
        return true;
      }
      return false;
    }

    // Fix parsing issue: C# returns "YYYY-MM-DDTHH:mm:ss" which Angular might parse as local or UTC differently.
    // Ensure we parse it to a clean timestamp. We assume the server returned Local Time for safety
    // For string ending without Z, browsers parse as local. Let's do that cleanly.
    let dateStr = ticket.assignedAt;
    if (dateStr.endsWith('Z')) dateStr = dateStr.slice(0, -1);
    
    const assignedTime = new Date(dateStr).getTime();
    
    let hoursAllowed = 36; // Default
    if (ticket.status === 'ASSIGNED') {
      hoursAllowed = 3; // 3h to accept
    } else if (ticket.priority === 3) hoursAllowed = 12; // High
    else if (ticket.priority === 2) hoursAllowed = 24; // Medium

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
      const formatted = `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
      ticket.timeLeftStr = formatted;
    }
    
    return oldStr !== ticket.timeLeftStr;
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

  loadTickets(): void {
    this.loadTicketsSub?.unsubscribe();
    this.loading = true;

    this.loadTicketsSub = this.ticketService.getAllTickets(this.filters)
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
          this.cdr.detectChanges();
        },
        error: (err) => {
          if (err?.status === 401) {
            alert('Your session has expired. Please log in again.');
            return;
          }
          if (err?.status === 403) {
            alert('You do not have permission to access all tickets.');
            return;
          }

          alert(err?.error?.message || err?.error || 'Cannot load tickets');
        }
      });
  }

  search(): void {
    this.currentPage = 1;
    this.loadTickets();
  }

  onFilterChanged(): void {
    this.currentPage = 1;
    this.loadTickets();
  }

  resetFilters(): void {
    this.filters = {
      search: '',
      status: '',
      priority: null,
      categoryId: null
    };
    this.currentPage = 1;
    this.loadTickets();
  }

  getPriorityLabel(priority?: number | null): string {
    if (priority === 1) return 'Low';
    if (priority === 2) return 'Medium';
    if (priority === 3) return 'High';
    return 'N/A';
  }

  // --- Modal & Action Logic ---
  alertMessage = '';
  isError = false;
  isLoading = false;

  showViewModal = false;
  showEditModal = false;
  showDeleteModal = false;

  currentDetail: any = null;
  editData: any = null;
  ticketToDelete: any = null;
  technicians: any[] = [];

  loadTechnicians(): void {
    if (this.technicians.length > 0) return;
    this.ticketService['http'].get<any[]>(`${this.ticketService['apiUrl'].replace('Tickets', 'Users')}`).subscribe({
      next: (users) => {
        this.technicians = users.filter((u: any) => u.roleName === 'Technician');
      },
      error: (err) => console.error('Failed to load technicians', err)
    });
  }

  openViewModal(ticket: MyTicketItem): void {
    this.ticketService.getTicketById(ticket.ticketId).subscribe({
      next: (res) => {
        this.currentDetail = {
          ...res,
          location: this.getLocationValue(res),
          imageBefore: this.getImagePath(res, 'imageBefore'),
          imageAfter: this.getImagePath(res, 'imageAfter')
        };
        this.showViewModal = true;
      },
      error: () => this.showAlert('Cannot load ticket details', true)
    });
  }

  openEditModal(ticket: MyTicketItem): void {
    this.loadTechnicians();
    this.ticketService.getTicketById(ticket.ticketId).subscribe({
      next: (res) => {
        this.editData = {
          ticketId: res.ticketId,
          title: res.title,
          description: res.description,
          location: this.getLocationValue(res),
          status: res.status,
          priority: res.priority,
          categoryId: res.categoryId,
          technicianId: res.technicianId || 0
        };
        this.showEditModal = true;
      },
      error: () => this.showAlert('Cannot load ticket for editing', true)
    });
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
    this.isLoading = true;
    this.ticketService.updateTicket(this.editData.ticketId, this.editData).subscribe({
      next: () => {
        this.showAlert('Ticket updated successfully', false);
        this.closeModals();
        this.loadTickets();
        this.isLoading = false;
      },
      error: (err) => {
        this.showAlert(err.error?.message || 'Failed to update ticket', true);
        this.isLoading = false;
      }
    });
  }

  confirmDelete(): void {
    if (!this.ticketToDelete) return;
    this.isLoading = true;
    this.ticketService.deleteTicket(this.ticketToDelete.ticketId).subscribe({
      next: () => {
        this.showAlert('Ticket deleted successfully', false);
        this.closeModals();
        this.loadTickets();
        this.isLoading = false;
      },
      error: (err) => {
        this.showAlert(err.error?.message || 'Failed to delete ticket', true);
        this.isLoading = false;
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

  truncateText(text: string | null | undefined, limit: number): string {
    if (!text) return '';
    if (text.length <= limit) return text;
    return text.substring(0, limit) + '...';
  }
}
