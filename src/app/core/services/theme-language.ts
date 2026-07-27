import { Injectable, signal, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeLanguageService {
  private translate = inject(TranslateService);

  currentLang = signal<'ar' | 'en'>('ar');
  currentTheme = signal<'light' | 'dark'>('light');

  constructor() {
    this.translate.setDefaultLang('ar');
    this.translate.use('ar');
    this.updateDirection('ar');
  }

  toggleLanguage() {
    const newLang = this.currentLang() === 'ar' ? 'en' : 'ar';
    this.currentLang.set(newLang);
    this.translate.use(newLang);
    this.updateDirection(newLang);
  }

  private updateDirection(lang: 'ar' | 'en') {
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
  }

  toggleTheme() {
    const newTheme = this.currentTheme() === 'light' ? 'dark' : 'light';
    this.currentTheme.set(newTheme);
    
    if (newTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }
}