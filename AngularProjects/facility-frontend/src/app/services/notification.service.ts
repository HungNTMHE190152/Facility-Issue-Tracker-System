import { Injectable, signal } from '@angular/core';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  id: number;
  type: NotificationType;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private nextId = 0;
  notifications = signal<Notification[]>([]);

  show(message: string, type: NotificationType = 'info', duration: number = 3000) {
    const id = this.nextId++;
    const newNotification: Notification = { id, message, type };
    
    this.notifications.update(prev => [...prev, newNotification]);

    setTimeout(() => {
      this.remove(id);
    }, duration);
  }

  success(message: string, duration?: number) {
    this.show(message, 'success', duration);
  }

  error(message: string, duration?: number) {
    this.show(message, 'error', duration);
  }

  info(message: string, duration?: number) {
    this.show(message, 'info', duration);
  }

  warning(message: string, duration?: number) {
    this.show(message, 'warning', duration);
  }

  remove(id: number) {
    this.notifications.update(prev => prev.filter(n => n.id !== id));
  }
}
