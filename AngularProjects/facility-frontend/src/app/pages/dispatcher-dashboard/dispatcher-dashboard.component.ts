import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.services';

@Component({
    selector: 'app-dispatcher-dashboard',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './dispatcher-dashboard.component.html',
    styleUrl: './dispatcher-dashboard.component.css'
})
export class DispatcherDashboardComponent {
    userName = '';

    constructor(private auth: AuthService, private router: Router) {
        this.userName = this.auth.getCurrentUserName();
    }

    goHome() {
        this.router.navigate(['/home']);
    }

    logout() {
        this.auth.logout();
        this.router.navigate(['/login']);
    }
}
