import { Component, inject, signal, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LanguageService } from '../../../core/services/language';

import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-language-selector',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div class="lang-selector-container">
      <button class="btn btn-ghost lang-btn" (click)="toggleDropdown()">
        <i class="bi bi-globe2"></i>
        <span>{{ (langService.currentLang() === 'ar' ? 'COMMON.ARABIC' : 'COMMON.ENGLISH') | translate }}</span>
        <i class="bi bi-chevron-down" style="font-size: 10px; margin-inline-start: 4px;"></i>
      </button>

      <div class="lang-dropdown" *ngIf="isOpen()">
        <button class="dropdown-item" [class.active]="langService.currentLang() === 'en'" (click)="setLang('en')">
          English
        </button>
        <button class="dropdown-item" [class.active]="langService.currentLang() === 'ar'" (click)="setLang('ar')">
          عربي
        </button>
      </div>
    </div>
  `,
  styles: [`
    .lang-selector-container {
      position: relative;
      display: inline-block;
    }
    .lang-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      font-size: var(--text-sm);
      color: var(--text-primary);
    }
    .lang-dropdown {
      position: absolute;
      top: 110%;
      right: 0;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-elevated);
      min-width: 120px;
      z-index: 1000;
      overflow: hidden;
      animation: fadeIn 0.2s ease;
    }
    html[dir="rtl"] .lang-dropdown {
      right: auto;
      left: 0;
    }
    .dropdown-item {
      display: block;
      width: 100%;
      text-align: start;
      padding: 10px 16px;
      background: none;
      border: none;
      font-size: var(--text-sm);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all var(--transition-fast);
      font-family: var(--font-body);
    }
    html[dir="rtl"] .dropdown-item {
      font-family: var(--font-arabic);
    }
    .dropdown-item:hover {
      background: var(--bg-elevated);
      color: var(--text-primary);
    }
    .dropdown-item.active {
      color: var(--mq-teal);
      font-weight: var(--font-semibold);
      background: var(--mq-teal-dim);
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class LanguageSelector {
  langService = inject(LanguageService);
  el = inject(ElementRef);
  isOpen = signal(false);

  toggleDropdown() {
    this.isOpen.update(v => !v);
  }

  setLang(lang: 'en' | 'ar') {
    if (this.langService.currentLang() !== lang) {
      this.langService.toggleLanguage();
    }
    this.isOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event) {
    if (!this.el.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
    }
  }
}
