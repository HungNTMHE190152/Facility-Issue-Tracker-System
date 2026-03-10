import { AfterViewInit, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
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

  constructor(
    private ticketService: TicketService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

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
