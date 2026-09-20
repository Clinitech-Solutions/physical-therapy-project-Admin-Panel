import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface User {
  id?: string;
  name: string;
  username: string;
  role: string;
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
    this.http.get<User[]>(`${this.apiUrl}/GetAll`).subscribe({
      next: (data) => {
        this.users.set(data);
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
