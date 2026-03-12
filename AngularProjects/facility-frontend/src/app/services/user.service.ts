// User Service - auto touched to reset TS Server Cache
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Role {
    roleId: number;
    roleName: string;
}

export interface User {
    userId: number;
    fullName: string;
    email: string;
    roleId: number;
    roleName: string;
}

export interface CreateUserDTO {
    fullName: string;
    email: string;
    password?: string;
    roleId: number;
}

export interface UpdateUserDTO {
    fullName: string;
    email: string;
    roleId: number;
}

@Injectable({
    providedIn: 'root'
})
export class UserService {
    private apiUrl = `${environment.apiUrl}/api/Users`;

    constructor(private http: HttpClient) { }

    private getAuthHeaders(): HttpHeaders {
        const token = localStorage.getItem('token');
        return new HttpHeaders({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        });
    }

    getUsers(): Observable<User[]> {
        return this.http.get<User[]>(this.apiUrl, { headers: this.getAuthHeaders() });
    }

    getRoles(): Observable<Role[]> {
        return this.http.get<Role[]>(`${this.apiUrl}/roles`, { headers: this.getAuthHeaders() });
    }

    createUser(user: CreateUserDTO): Observable<any> {
        return this.http.post(this.apiUrl, user, { headers: this.getAuthHeaders() });
    }

    updateUser(id: number, user: UpdateUserDTO): Observable<any> {
        return this.http.put(`${this.apiUrl}/${id}`, user, { headers: this.getAuthHeaders() });
    }

    deleteUser(id: number): Observable<any> {
        return this.http.delete(`${this.apiUrl}/${id}`, { headers: this.getAuthHeaders() });
    }
}
