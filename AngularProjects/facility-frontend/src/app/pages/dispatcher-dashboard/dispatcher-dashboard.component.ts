import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.services';
import { UserService } from '../../services/user.service';

@Component({
    selector: 'app-dispatcher-dashboard',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './dispatcher-dashboard.component.html',
    styleUrl: './dispatcher-dashboard.component.css'
})
export class DispatcherDashboardComponent {
    userName = '';

    constructor(private auth: AuthService, private router: Router,
        private userService: UserService
    ) {
        this.userName = this.auth.getCurrentUserName();
    }
    onExportExcel() {
        this.userService.export_excel({}).subscribe({
      next: (res: any) => {

    const base64 = res.fileContents;

    // decode base64 → binary
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);

    const blob = new Blob([byteArray], {
      type: res.contentType
    });

    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = res.fileDownloadName;

    document.body.appendChild(a);
    a.click();

    a.remove();
    window.URL.revokeObjectURL(url);
  },
  error: (err) => {
    console.error(err);
    alert('Tải file thất bại');
  }
});
    }
    goHome() {
        this.router.navigate(['/home']);
    }

    logout() {
        this.auth.logout();
        this.router.navigate(['/login']);
    }
}
