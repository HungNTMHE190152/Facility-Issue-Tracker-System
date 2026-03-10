import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { CategoryOption, CreateTicketRequest, MyTicketFilters, MyTicketItem } from '../models/ticket.models';

@Injectable({
  providedIn: 'root'
})
export class TicketService {
  private apiUrl = `${environment.apiUrl}/api/Tickets`;

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  getCategories(): Observable<CategoryOption[]> {
    return this.http.get<CategoryOption[]>(`${this.apiUrl}/categories`);
  }

  createTicket(data: CreateTicketRequest): Observable<{ message: string; ticketId: number }> {
    return this.http.post<{ message: string; ticketId: number }>(this.apiUrl, data, { headers: this.getAuthHeaders() });
  }

  getMyTickets(filters: MyTicketFilters): Observable<MyTicketItem[]> {
    let params = new HttpParams();

    if (filters.search?.trim()) {
      params = params.set('search', filters.search.trim());
    }

    if (filters.status?.trim()) {
      params = params.set('status', filters.status.trim());
    }

    if (filters.priority !== null && filters.priority !== undefined) {
      params = params.set('priority', String(filters.priority));
    }

    if (filters.categoryId !== null && filters.categoryId !== undefined) {
      params = params.set('categoryId', String(filters.categoryId));
    }

    return this.http.get<any>(`${this.apiUrl}/my-ticket`, { headers: this.getAuthHeaders(), params }).pipe(
      map((res: any) => {
        if (Array.isArray(res)) {
          return res as MyTicketItem[];
        }

        if (res && Array.isArray(res.value)) {
          return res.value as MyTicketItem[];
        }

        return [];
      })
    );
  }

  getAllTickets(filters: MyTicketFilters): Observable<MyTicketItem[]> {
    let params = new HttpParams();

    if (filters.search?.trim()) {
      params = params.set('search', filters.search.trim());
    }

    if (filters.status?.trim()) {
      params = params.set('status', filters.status.trim());
    }

    if (filters.priority !== null && filters.priority !== undefined) {
      params = params.set('priority', String(filters.priority));
    }

    if (filters.categoryId !== null && filters.categoryId !== undefined) {
      params = params.set('categoryId', String(filters.categoryId));
    }

    return this.http.get<any>(`${this.apiUrl}/all`, { headers: this.getAuthHeaders(), params }).pipe(
      map((res: any) => {
        if (Array.isArray(res)) {
          return res as MyTicketItem[];
        }

        if (res && Array.isArray(res.value)) {
          return res.value as MyTicketItem[];
        }

        return [];
      })
    );
  }

  getTicketById(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`, { headers: this.getAuthHeaders() });
  }

  updateTicket(id: number, data: any): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/${id}`, data, { headers: this.getAuthHeaders() });
  }

  deleteTicket(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`, { headers: this.getAuthHeaders() });
  }
}
