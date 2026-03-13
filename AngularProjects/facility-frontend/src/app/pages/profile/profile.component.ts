import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.services';
import { TicketService } from '../../services/ticket.service';
import { MyTicketItem } from '../../models/ticket.models';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent implements OnInit {
  user: any = null;
  loadingProfile = true;
  loadingTickets = true;
  errorMessage = '';
  isEditing = false;
  isSaving = false;
  successMessage = '';
  cachedName = '';
  cachedEmail = '';
  cachedRole = '';
  recentTickets: MyTicketItem[] = [];
  editData: any = {
    fullName: ''
  };

  constructor(
    private auth: AuthService, 
    private ticketService: TicketService,
    private router: Router
  ) { }

  ngOnInit() {
    this.cachedName = this.auth.getCurrentUserName();
    this.cachedEmail = this.auth.getCurrentUserEmail();
    this.cachedRole = this.auth.getCurrentUserRole();
    this.recentTickets = this.auth.getCachedRecentTickets() || []; // Load instant cache
    
    // Only show spinner if we have NO cached tickets
    this.loadingTickets = this.recentTickets.length === 0;

    this.loadProfile();
    this.loadRecentTickets();
  }

  loadProfile() {
    this.loadingProfile = true;
    this.auth.getProfile().subscribe({
      next: (res) => {
        this.user = res;
        this.cachedName = res.fullName;
        this.cachedRole = res.role;
        this.cachedEmail = res.email;
        this.editData = {
          fullName: res.fullName
        };
        this.loadingProfile = false;
      },
      error: (err) => {
        console.error('Error in getting profile:', err);
        this.errorMessage = 'Could not load profile information.';
        this.loadingProfile = false;
        if (err.status === 401) {
          this.auth.logout();
          this.router.navigate(['/login']);
        }
      }
    });
  }

  loadRecentTickets() {
    // If we already have tickets from cache, don't set loadingTickets to true
    // This prevents the data from being replaced by a spinner
    if (this.recentTickets.length === 0) {
      this.loadingTickets = true;
    }

    this.ticketService.getMyTickets({})
      .pipe(finalize(() => {
        this.loadingTickets = false;
      }))
      .subscribe({
        next: (tickets) => {
          if (!tickets || !Array.isArray(tickets)) {
            console.warn('[Profile] Received invalid tickets data:', tickets);
            return;
          }

          console.log('[Profile] Loaded tickets:', tickets.length);
          // Order: Status Changed (not OPEN) first, then OPEN
          this.recentTickets = tickets.sort((a, b) => {
            const aActive = this.getStatusWeight(a.status);
            const bActive = this.getStatusWeight(b.status);
            
            if (aActive === bActive) {
              return b.ticketId - a.ticketId;
            }
            return bActive - aActive; 
          }).slice(0, 5);
          
          this.auth.setCachedRecentTickets(this.recentTickets); // Update cache
        },
        error: (err) => {
          console.error('[Profile] Error loading tickets:', err);
          // loadingTickets is handled by finalize
        }
      });
  }

  getStatusWeight(status: string): number {
    const s = status.toUpperCase();
    if (s === 'IN PROGRESS') return 3;
    if (s === 'ASSIGNED') return 2;
    if (s === 'RESOLVED') return 2;
    if (s === 'CLOSED') return 1;
    return 0; // OPEN or others
  }

  isTicketActive(ticket: MyTicketItem): boolean {
    return ticket.status.toUpperCase() !== 'OPEN';
  }

  isEditable(ticket: MyTicketItem): boolean {
    if (!ticket) return false;
    const role = this.auth.getCurrentUserRole();
    const status = ticket.status?.toUpperCase();

    if (status === 'CLOSED') return false;

    if (role === 'Reporter') {
      return status === 'OPEN';
    }
    return true;
  }

  toggleEdit() {
    this.isEditing = !this.isEditing;
    if (!this.isEditing && this.user) {
      this.editData = {
        fullName: this.user.fullName
      };
      this.successMessage = '';
      this.errorMessage = '';
    }
  }

  saveProfile() {
    this.isSaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.auth.updateProfile(this.editData).subscribe({
      next: (res) => {
        this.user.fullName = this.editData.fullName;
        this.isEditing = false;
        this.isSaving = false;
        this.successMessage = 'Update profile successfully!';

        // Sử dụng hàm an toàn mới thêm
        this.auth.updateUserName(this.user.fullName);

        setTimeout(() => {
          this.successMessage = '';
        }, 3000);
      },
      error: (err) => {
        console.error('Error update profile:', err);
        this.errorMessage = 'Can not update profile.';
        this.isSaving = false;
      }
    });
  }

  getInitials(name: string): string {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }

  truncateText(text: string, limit: number = 40): string {
    if (!text) return '';
    return text.length > limit ? text.substring(0, limit) + '...' : text;
  }
}
