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

  private isLoggedInSubject = new BehaviorSubject<boolean>(this.hasValidToken());
  private userNameSubject = new BehaviorSubject<string>('');
  private userRoleSubject = new BehaviorSubject<string>('');

  isLoggedIn$ = this.isLoggedInSubject.asObservable();
  userName$ = this.userNameSubject.asObservable();
  userRole$ = this.userRoleSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadUserFromStorage();
  }

  private clearStoredAuth(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('fullName');
    localStorage.removeItem('role');
  }

  private isTokenExpired(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return true;

      const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payloadJson = atob(payloadBase64);
      const payload = JSON.parse(payloadJson) as { exp?: number };

      if (!payload.exp) return true;
      const nowInSeconds = Math.floor(Date.now() / 1000);
      return payload.exp <= nowInSeconds;
    } catch {
      return true;
    }
  }

  private hasValidToken(): boolean {
    const token = localStorage.getItem('token');
    if (!token) return false;

    if (this.isTokenExpired(token)) {
      this.clearStoredAuth();
      return false;
    }

    return true;
  }

  private loadUserFromStorage() {
    const token = localStorage.getItem('token');
    const fullName = localStorage.getItem('fullName') || '';
    const role = localStorage.getItem('role') || 'Reporter';

    if (token && !this.isTokenExpired(token)) {
      this.isLoggedInSubject.next(true);
      this.userNameSubject.next(fullName.trim() || 'User');
      this.userRoleSubject.next(role.trim());
    } else {
      this.clearStoredAuth();
      this.isLoggedInSubject.next(false);
      this.userNameSubject.next('');
      this.userRoleSubject.next('');
    }
  }

  sendRegisterOtp(email: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/register/send-otp`, { email }).pipe(
      catchError(err => {
        console.error('Send register OTP failed:', err);
        return throwError(() => err);
      })
    );
  }

  verifyRegisterOtp(email: string, otp: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/register/verify-otp`, { email, otp }).pipe(
      catchError(err => {
        console.error('Verify register OTP failed:', err);
        return throwError(() => err);
      })
    );
  }

  register(data: { fullName: string; email: string; password: string; otp: string }): Observable<any> {
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

          this.userNameSubject.next(res.fullName?.trim() || 'User');
          this.userRoleSubject.next(res.role?.trim() || 'Reporter');
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
    this.clearStoredAuth();
    this.isLoggedInSubject.next(false);
    this.userNameSubject.next('');
    this.userRoleSubject.next('');
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

  isAuthenticated(): boolean {
    return this.isLoggedInSubject.value;
  }
}