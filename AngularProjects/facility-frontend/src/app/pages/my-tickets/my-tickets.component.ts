import { AfterViewInit, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { TicketService } from '../../services/ticket.service';
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
  currentDetail: MyTicketItem | null = null;
  editData: any = null;
  ticketToDelete: MyTicketItem | null = null;
  alertMessage = '';
  isError = false;

  constructor(
    private ticketService: TicketService,
    private cdr: ChangeDetectorRef
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
          this.cdr.detectChanges();
        },
        error: (err) => {
          if (err?.status === 401) {
            alert('Your session has expired. Please log in again.');
            return;
          }

          alert(err?.error?.message || err?.error || 'Cannot load tickets');
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

  // Action Methods
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
}
