import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
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

  getCategories(): Observable<CategoryOption[]> {
    return this.http.get<CategoryOption[]>(`${this.apiUrl}/categories`);
  }

  createTicket(data: CreateTicketRequest): Observable<{ message: string; ticketId: number }> {
    return this.http.post<{ message: string; ticketId: number }>(this.apiUrl, data);
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

    return this.http.get<any>(`${this.apiUrl}/my-ticket`, { params }).pipe(
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
}
