import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
  import { CategoryOption, CreateTicketRequest, MyTicketFilters, MyTicketItem, TicketHistory, UpdateTicketRequest } from '../models/ticket.models';

@Injectable({
  providedIn: 'root'
})
export class TicketService {
  private apiUrl = `${environment.apiUrl}/api/Tickets`;

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    const headersObj: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headersObj['Authorization'] = `Bearer ${token}`;
    }
    return new HttpHeaders(headersObj);
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

    if (filters.fromDate?.trim()) {
      params = params.set('fromDate', filters.fromDate.trim());
    }

    if (filters.toDate?.trim()) {
      params = params.set('toDate', filters.toDate.trim());
    }

    if (filters.createdSort) {
      params = params.set('createdSort', filters.createdSort);
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

    if (filters.fromDate?.trim()) {
      params = params.set('fromDate', filters.fromDate.trim());
    }

    if (filters.toDate?.trim()) {
      params = params.set('toDate', filters.toDate.trim());
    }

    if (filters.createdSort) {
      params = params.set('createdSort', filters.createdSort);
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

  deleteTicket(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`, { headers: this.getAuthHeaders() });
  }

  getTicketById(id: number): Observable<MyTicketItem> {
    return this.http.get<MyTicketItem>(`${this.apiUrl}/${id}`, { headers: this.getAuthHeaders() });
  }

  updateTicket(id: number, data: UpdateTicketRequest): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/${id}`, data, { headers: this.getAuthHeaders() });
  }

  updateTicketManager(id: number, data: { status?: string; technicianId?: number | null }): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/${id}`, data, { headers: this.getAuthHeaders() });
  }
  
 exportTickets(): Observable<{ url: string }> {
  return this.http.post<{ url: string }>(`${this.apiUrl}/export-excel`, {}, { headers: this.getAuthHeaders() });
}

  /**
   * 2. Nhập dữ liệu Vật tư: Gửi file Excel lên Server
   * Lưu ý: Không ép kiểu 'Content-Type': 'application/json' để trình duyệt tự xử lý FormData.
   */
  importSupplies(file: File): Observable<{ message: string }> {
    const formData = new FormData();
    formData.append('file', file); // Tên 'file' phải khớp với tham số trong Backend (IFormFile file)

    const token = localStorage.getItem('token');
    const headers = token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : undefined;

    return this.http.post<{ message: string }>(
      `${this.apiUrl}/import-supplies`,
      formData,
      headers ? { headers } : undefined
    );
  }

  // ================= Technician Dashboard (US-34/35/36/41/42) =================
  getTechnicianDashboard(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/technician-dashboard`, { headers: this.getAuthHeaders() });
  }

  // ================= Technician Actions =================
  acceptTechnicianTicket(id: number): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/${id}/accept`, {}, { headers: this.getAuthHeaders() });
  }

  rejectTechnicianTicket(id: number): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/${id}/reject`, {}, { headers: this.getAuthHeaders() });
  }

  startTechnicianTicket(id: number): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/${id}/start`, {}, { headers: this.getAuthHeaders() });
  }

  resolveTechnicianTicket(id: number, data: { imageAfter?: string | null }): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/${id}/resolve`, data, { headers: this.getAuthHeaders() });
  }

  // New aliases/methods for MissionsComponent
  getActiveMissions(): Observable<MyTicketItem[]> {
    return this.http.get<MyTicketItem[]>(`${this.apiUrl}/active-missions`, { headers: this.getAuthHeaders() });
  }

  approveTicket(id: number): Observable<{ message: string }> {
    return this.acceptTechnicianTicket(id);
  }

  rejectTicket(id: number): Observable<{ message: string }> {
    return this.rejectTechnicianTicket(id);
  }

  startTicket(id: number): Observable<{ message: string }> {
    return this.startTechnicianTicket(id);
  }

  pauseTicket(id: number): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/${id}/pause`, {}, { headers: this.getAuthHeaders() });
  }

  resumeTicket(id: number): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/${id}/resume`, {}, { headers: this.getAuthHeaders() });
  }

  resolveTicket(id: number, data: any): Observable<{ message: string }> {
    return this.resolveTechnicianTicket(id, data);
  }

  /**
   * 3. Lấy dữ liệu thống kê Dashboard
   * Dùng để vẽ biểu đồ tròn hoặc bảng xếp hạng kỹ thuật viên
   */
  getDashboardStats(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/dashboard-stats`, { headers: this.getAuthHeaders() });
  }

  exportResolvedTickets(): Observable<{ url: string }> {
    return this.http.post<{ url: string }>(`${this.apiUrl}/export-resolved-excel`, {}, { headers: this.getAuthHeaders() });
  }

  exportMaterialCostReport(): Observable<{ url: string }> {
    return this.http.post<{ url: string }>(`${this.apiUrl}/export-material-cost-excel`, {}, { headers: this.getAuthHeaders() });
  }

  exportMaintenanceLogExcel(): Observable<{ url: string }> {
    return this.http.post<{ url: string }>(`${this.apiUrl}/export-maintenance-log-excel`, {}, { headers: this.getAuthHeaders() });
  }

  closeTicketWithReview(id: number, data: { rating: number; comment?: string | null }): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/${id}/close`, data, { headers: this.getAuthHeaders() });
  }

  getTicketHistory(id: number): Observable<TicketHistory[]> {
    return this.http.get<TicketHistory[]>(`${this.apiUrl}/${id}/history`, { headers: this.getAuthHeaders() });
  }

  getAssignmentSuggestions(ticketId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${ticketId}/assignment-suggestions`, { headers: this.getAuthHeaders() });
  }

  assignTicket(ticketId: number, technicianId: number): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(
      `${this.apiUrl}/${ticketId}/assign`,
      { technicianId },
      { headers: this.getAuthHeaders() }
    );
  }

  getReporterDashboard(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/reporter-dashboard`, { headers: this.getAuthHeaders() });
  }
  
}
