import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { PrimeNG } from 'primeng/config';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export type LanguageCode = 'en' | 'ar';

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  currentLang = signal<LanguageCode>('en');
  private platformId = inject(PLATFORM_ID);
  private translate = inject(TranslateService);
  private primeNG = inject(PrimeNG, { optional: true });

  constructor() {
    this.translate.onLangChange.pipe(takeUntilDestroyed()).subscribe(event => {
      const locale = event.translations['PRIMENG'];
      if (locale) this.primeNG?.setTranslation(locale);
    });
    this.translate.setDefaultLang('en');
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
      this.translate.use(this.currentLang());
      this.applyLang();
    }
  }

  toggleLanguage() {
    this.currentLang.set(this.currentLang() === 'en' ? 'ar' : 'en');
    this.translate.use(this.currentLang());
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

