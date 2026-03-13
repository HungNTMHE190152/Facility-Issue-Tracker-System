import { AfterViewInit, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { TicketService } from '../../services/ticket.service';
import { AuthService } from '../../services/auth.services';
import { CategoryOption, MyTicketFilters, MyTicketItem } from '../../models/ticket.models';

@Component({
  selector: 'app-technician-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './technician-tasks.component.html',
  styleUrl: './technician-tasks.component.css'
})
export class TechnicianTasksComponent implements OnInit, OnDestroy {
  tickets: MyTicketItem[] = [];
  categories: CategoryOption[] = [];
  loading = false;
  hasLoaded = false;
  userRole = '';
  userName = '';
  
  filters: MyTicketFilters = {
    search: '',
    status: '', 
    priority: null,
    categoryId: null
  };

  private loadTicketsSub?: Subscription;
  private timerInterval: any;

  // Modal/Detail states
  currentDetail: MyTicketItem | null = null;
  showViewModal = false;

  constructor(
    private ticketService: TicketService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.userRole = (this.authService.getCurrentUserRole() || '').toLowerCase();
    this.userName = this.authService.getCurrentUserName() || 'Technician';
    this.startCountdownTimer();
    this.loadCategories();

    this.route.queryParams.subscribe(params => {
      if (params['status']) this.filters.status = params['status'];
      if (params['search']) this.filters.search = params['search'];
      this.loadTickets();
    });
  }

  ngOnDestroy(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  loadCategories(): void {
    this.ticketService.getCategories().subscribe({
      next: (res) => this.categories = res,
      error: () => this.categories = []
    });
  }

  loadTickets(): void {
    this.loading = true;
    this.ticketService.getAllTickets(this.filters)
      .pipe(finalize(() => {
        this.loading = false;
        this.hasLoaded = true;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (res) => {
          this.tickets = res.map(t => ({
            ...t,
            isMyTask: t.technicianName === this.userName
          }));
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error loading tickets', err);
        }
      });
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
        alert('Phòng kỹ thuật đã tiếp nhận yêu cầu!');
        this.loadTickets();
      },
      error: (err) => {
        alert(err.error?.message || 'Không thể tiếp nhận vé. Có thể đã quá hạn 3h.');
        this.loading = false;
      }
    });
  }

  // Timer Logic
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
    if (changed) this.cdr.detectChanges();
  }

  calculateTimeLeft(ticket: any, now: number): boolean {
    if ((ticket.status !== 'ASSIGNED' && ticket.status !== 'IN_PROGRESS' && ticket.status !== 'OPEN') || !ticket.assignedAt) {
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
    
    let hoursAllowed = 3; // SLA 3h cho ASSIGNED/OPEN (khi đã gán)
    if (ticket.status === 'IN_PROGRESS') {
       hoursAllowed = ticket.priority === 3 ? 12 : (ticket.priority === 2 ? 24 : 36);
    }

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

  getPriorityLabel(priority?: number | null): string {
    if (priority === 1) return 'Low';
    if (priority === 2) return 'Medium';
    if (priority === 3) return 'High';
    return 'N/A';
  }

  openViewModal(ticket: MyTicketItem): void {
    this.currentDetail = ticket;
    this.showViewModal = true;
  }

  closeModals(): void {
    this.showViewModal = false;
    this.currentDetail = null;
  }
}
