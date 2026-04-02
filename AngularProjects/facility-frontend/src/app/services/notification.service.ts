import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Notification } from '../models/notification.models';
import { environment } from '../../environments/environment';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastNotification {
  id: number;
  type: ToastType;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private nextId = 0;
  toastNotifications = signal<ToastNotification[]>([]);
  private apiUrl = `${environment.apiUrl}/api/notifications`;

  constructor(private http: HttpClient) {}

  // Backend Notifications
  getNotifications(): Observable<Notification[]> {
    return this.http.get<Notification[]>(this.apiUrl);
  }

  getUnreadCount(): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/unread-count`);
  }

  markAsRead(id: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}/read`, {});
  }

  markAllAsRead(): Observable<any> {
    return this.http.put(`${this.apiUrl}/read-all`, {});
  }

  // UI Toast Notifications
  show(message: string, type: ToastType = 'info', duration: number = 3000) {
    const id = this.nextId++;
    const newToast: ToastNotification = { id, message, type };
    
    this.toastNotifications.update(prev => [...prev, newToast]);

    setTimeout(() => {
      this.removeToast(id);
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

  removeToast(id: number) {
    this.toastNotifications.update(prev => prev.filter(n => n.id !== id));
  }
}
