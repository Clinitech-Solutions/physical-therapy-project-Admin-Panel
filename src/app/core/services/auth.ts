import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';

export type UserRole = 'Receptionist' | 'Senior Therapist' | 'Doctor' | 'CEO' | null;

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  currentRole = signal<UserRole>(null);
  private platformId = inject(PLATFORM_ID);

  private router = inject(Router);

  constructor() {
    this.initAuth();
  }

  initAuth() {
    if (isPlatformBrowser(this.platformId)) {
      const saved = localStorage.getItem('mediqova-role') as UserRole;
      if (saved) {
        this.currentRole.set(saved);
      }
    }
  }

  login(role: UserRole) {
    this.currentRole.set(role);
    if (isPlatformBrowser(this.platformId)) {
      if (role) {
        localStorage.setItem('mediqova-role', role);
      } else {
        localStorage.removeItem('mediqova-role');
      }
    }
  }

  logout() {
    this.currentRole.set(null);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('mediqova-role');
    }
    this.router.navigate(['/login']);
  }
}

