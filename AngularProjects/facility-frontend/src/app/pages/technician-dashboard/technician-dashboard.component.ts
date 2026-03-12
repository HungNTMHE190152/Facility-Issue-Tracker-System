import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.services';

@Component({
  selector: 'app-technician-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './technician-dashboard.component.html',
  styleUrl: './technician-dashboard.component.css'
})
export class TechnicianDashboardComponent implements OnInit {
  userName: string = '';

  constructor(private auth: AuthService, private router: Router) { }

  ngOnInit(): void {
    this.userName = this.auth.getCurrentUserName() || 'Technician';
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}
