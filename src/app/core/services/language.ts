import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type LanguageCode = 'en' | 'ar';

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  currentLang = signal<LanguageCode>('en');
  private platformId = inject(PLATFORM_ID);

  constructor() {
    this.initLang();
  }

  initLang() {
    if (isPlatformBrowser(this.platformId)) {
      const saved = localStorage.getItem('mediqova-lang') as LanguageCode;
      if (saved === 'en' || saved === 'ar') {
        this.currentLang.set(saved);
      } else {
        // Default to english
        this.currentLang.set('en');
      }
      this.applyLang();
    }
  }

  toggleLanguage() {
    this.currentLang.set(this.currentLang() === 'en' ? 'ar' : 'en');
    this.applyLang();
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('mediqova-lang', this.currentLang());
    }
  }

  private applyLang() {
    if (isPlatformBrowser(this.platformId)) {
      const isArabic = this.currentLang() === 'ar';
      document.documentElement.setAttribute('dir', isArabic ? 'rtl' : 'ltr');
      document.documentElement.setAttribute('lang', this.currentLang());
    }
  }
}

