import { Injectable, signal, PLATFORM_ID, inject, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { UserRole, LoginRequest, AuthResponse, User } from '../models/auth.model';
import { environment } from '../../../environments/environment';
export type { UserRole } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly TOKEN_KEY = 'mediqova-token';
  
  currentRole = signal<UserRole | null>(null);
  currentUser = signal<User | null>(null);
  isAuthenticated = computed(() => !!this.currentUser());
  
  private platformId = inject(PLATFORM_ID);
  private router = inject(Router);
  private http = inject(HttpClient);

  constructor() {
    this.initAuth();
  }

  initAuth() {
    if (isPlatformBrowser(this.platformId)) {
      const token = this.getToken();
      if (token) {
        this.processToken(token);
      }
    }
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, credentials).pipe(
      tap(response => {
        if (response && response.token) {
          this.setToken(response.token);
          this.processToken(response.token);
        }
      })
    );
  }

  logout() {
    this.currentRole.set(null);
    this.currentUser.set(null);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(this.TOKEN_KEY);
    }
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem(this.TOKEN_KEY);
    }
    return null;
  }

  hasRole(role: string): boolean {
    const user = this.currentUser();
    return !!user?.roles?.includes(role as UserRole);
  }

  private setToken(token: string) {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.TOKEN_KEY, token);
    }
  }

  private processToken(token: string) {
    const payload = this.decodeJwt(token);
    if (payload) {
      // Decode .NET roles which can be stored in the 'role' or the schema URL claim
      const rolesClaim = payload['role'] || payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
      let roles: UserRole[] = [];
      
      if (Array.isArray(rolesClaim)) {
        roles = rolesClaim;
      } else if (typeof rolesClaim === 'string') {
        roles = [rolesClaim];
      }

      this.currentRole.set(roles.length > 0 ? roles[0] : null);
      
      this.currentUser.set({
        id: payload.nameid || payload.sub || '',
        email: payload.email || '',
        roles: roles,
        ...payload
      });
    }
  }

  private decodeJwt(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      if (!base64Url) return null;
      
      // Base64Url decode without third party libs
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error('Error decoding JWT', e);
      return null;
    }
  }
}
