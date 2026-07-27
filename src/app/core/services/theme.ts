import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  isDarkMode = signal<boolean>(true);
  private platformId = inject(PLATFORM_ID);

  constructor() {
    this.initTheme();
  }

  initTheme() {
    if (isPlatformBrowser(this.platformId)) {
      const saved = localStorage.getItem('mediqova-theme');
      if (saved) {
        this.isDarkMode.set(saved === 'dark');
      } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.isDarkMode.set(prefersDark);
      }
      this.applyTheme();
    }
  }

  toggleTheme() {
    this.isDarkMode.set(!this.isDarkMode());
    this.applyTheme();
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('mediqova-theme', this.isDarkMode() ? 'dark' : 'light');
    }
  }

  private applyTheme() {
    if (isPlatformBrowser(this.platformId)) {
      if (this.isDarkMode()) {
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.add('light');
      }
    }
  }
}
