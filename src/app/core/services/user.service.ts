import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface ApiResponse<T> {
  value: T;
  isSuccess: boolean;
  isFailure?: boolean;
}

export interface User {
  id?: string;
  fullName: string;
  userName: string;
  roles: string[];
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/Users`; 

  // Signal state management
  users = signal<User[]>([]);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  getAllUsers() {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<ApiResponse<User[]>>(`${this.apiUrl}/GetAll`).subscribe({
      next: (data) => {
        this.users.set(data.value);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to fetch users');
        this.loading.set(false);
      }
    });
  }

  addUser(payload: Partial<User>) {
    return this.http.post<User>(`${this.apiUrl}/Add`, payload);
  }
}
