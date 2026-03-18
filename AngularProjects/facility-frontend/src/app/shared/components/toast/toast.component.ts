import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../../services/notification.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      <div *ngFor="let n of notificationService.notifications()" 
           class="toast-item" 
           [class]="n.type"
           (click)="notificationService.remove(n.id)">
        <div class="toast-icon">
          <span *ngIf="n.type === 'success'">✅</span>
          <span *ngIf="n.type === 'error'">❌</span>
          <span *ngIf="n.type === 'info'">ℹ️</span>
          <span *ngIf="n.type === 'warning'">⚠️</span>
        </div>
        <div class="toast-content">
          <p class="toast-message">{{ n.message }}</p>
        </div>
        <button class="toast-close">&times;</button>
      </div>
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: none;
    }

    .toast-item {
      pointer-events: auto;
      min-width: 300px;
      max-width: 450px;
      padding: 16px;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.3);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      animation: slideIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275),
                 fadeOut 0.3s ease forwards;
      animation-delay: 0s, 2.7s; /* Matches default 3s duration */
    }

    .toast-item.success {
      border-left: 6px solid #10b981;
      background: rgba(16, 185, 129, 0.1);
    }

    .toast-item.error {
      border-left: 6px solid #ef4444;
      background: rgba(239, 68, 68, 0.1);
    }

    .toast-item.info {
      border-left: 6px solid #3b82f6;
      background: rgba(59, 130, 246, 0.1);
    }

    .toast-item.warning {
      border-left: 6px solid #f59e0b;
      background: rgba(245, 158, 11, 0.1);
    }

    .toast-icon {
      font-size: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .toast-content {
      flex: 1;
    }

    .toast-message {
      margin: 0;
      font-size: 14px;
      font-weight: 500;
      color: #1f2937;
      line-height: 1.5;
    }

    .toast-close {
      background: none;
      border: none;
      font-size: 20px;
      color: #9ca3af;
      cursor: pointer;
      padding: 0 4px;
      transition: color 0.2s;
    }

    .toast-close:hover {
      color: #4b5563;
    }

    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @keyframes fadeOut {
      from {
        opacity: 1;
        transform: scale(1);
      }
      to {
        opacity: 0;
        transform: scale(0.95);
      }
    }
  `]
})
export class ToastComponent {
  notificationService = inject(NotificationService);
}
