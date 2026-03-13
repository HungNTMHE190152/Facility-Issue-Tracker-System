import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private apiUrl = `${environment.apiUrl}/api/Auth`;

  private isLoggedInSubject = new BehaviorSubject<boolean>(this.hasToken());
  private userNameSubject = new BehaviorSubject<string>('');
  private userRoleSubject = new BehaviorSubject<string>('');
  private userEmailSubject = new BehaviorSubject<string>('');

  isLoggedIn$ = this.isLoggedInSubject.asObservable();
  userName$ = this.userNameSubject.asObservable();
  userRole$ = this.userRoleSubject.asObservable();
  userEmail$ = this.userEmailSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadUserFromStorage();
  }

  private hasToken(): boolean {
    return !!localStorage.getItem('token');
  }

  private loadUserFromStorage() {
    const token = localStorage.getItem('token');
    const fullName = localStorage.getItem('fullName') || '';
    const role = localStorage.getItem('role') || 'Reporter';
    const email = localStorage.getItem('email') || '';

    if (token) {
      this.isLoggedInSubject.next(true);
      this.userNameSubject.next(fullName.trim() || 'User');
      this.userRoleSubject.next(role.trim());
      this.userEmailSubject.next(email.trim());
    } else {
      this.isLoggedInSubject.next(false);
      this.userNameSubject.next('');
      this.userRoleSubject.next('');
      this.userEmailSubject.next('');
    }
  }

  register(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, data, { responseType: 'text' }).pipe(
      catchError(err => {
        console.error('Register failed:', err);
        return throwError(() => err);
      })
    );
  }

  login(credentials: { email: string; password: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, credentials).pipe(
      tap(res => {
        if (res.token) {
          localStorage.setItem('token', res.token);
          localStorage.setItem('fullName', res.fullName?.trim() || 'User');
          localStorage.setItem('role', res.role?.trim() || 'Reporter');
          localStorage.setItem('email', res.email?.trim() || credentials.email);

          this.userNameSubject.next(res.fullName?.trim() || 'User');
          this.userRoleSubject.next(res.role?.trim() || 'Reporter');
          this.userEmailSubject.next(res.email?.trim() || credentials.email);
          this.isLoggedInSubject.next(true);
        }
      }),
      catchError(err => {
        console.error('Login failed:', err);
        return throwError(() => err);
      })
    );
  }

  logout(): void {
    this.userNameSubject.next('');
    this.userRoleSubject.next('');
    this.userEmailSubject.next('');
    localStorage.removeItem('token');
    localStorage.removeItem('fullName');
    localStorage.removeItem('role');
    localStorage.removeItem('email');
  }

  getProfile(): Observable<any> {
    return this.http.get(`${this.apiUrl}/profile`);
  }

  updateProfile(data: { fullName?: string }): Observable<any> {
    return this.http.put(`${this.apiUrl}/profile`, data);
  }

  changePassword(data: { oldPassword: string; newPassword: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/change-password`, data);
  }

  forgotPassword(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/forgot-password`, { email });
  }

  resetPassword(data: { email: string; otp: string; newPassword: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/reset-password`, data);
  }


  /**
   * Cập nhật tên hiển thị (gọi sau khi PUT profile thành công)
   */
  updateUserName(newName: string): void {
    if (newName && newName.trim()) {
      const trimmed = newName.trim();
      this.userNameSubject.next(trimmed);
      localStorage.setItem('fullName', trimmed);
      console.log('[AuthService] Updated user name:', trimmed);
    }
  }

  /**
   * Cập nhật thông tin user local (tên + role + mở rộng sau này)
   */
  updateUserInfo(updates: { fullName?: string; role?: string;[key: string]: any }): void {
    if (updates.fullName) {
      this.updateUserName(updates.fullName);
    }
    if (updates.role) {
      const trimmedRole = updates.role.trim();
      this.userRoleSubject.next(trimmedRole);
      localStorage.setItem('role', trimmedRole);
      console.log('[AuthService] Updated user role:', trimmedRole);
    }
    // Có thể mở rộng thêm phone, department, position nếu cần lưu local
  }

  getCurrentUserName(): string {
    return this.userNameSubject.value || 'Guest';
  }

  getCurrentUserRole(): string {
    return this.userRoleSubject.value || 'Reporter';
  }

  getCurrentUserEmail(): string {
    return this.userEmailSubject.value || '';
  }

  getCachedRecentTickets(): any[] {
    const cached = localStorage.getItem('recentTickets');
    return cached ? JSON.parse(cached) : [];
  }

  setCachedRecentTickets(tickets: any[]): void {
    localStorage.setItem('recentTickets', JSON.stringify(tickets));
  }

  isAuthenticated(): boolean {
    return this.isLoggedInSubject.value;
  }
}