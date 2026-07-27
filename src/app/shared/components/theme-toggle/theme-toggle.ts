import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../../core/services/theme';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button class="theme-switch" (click)="theme.toggleTheme()" [attr.aria-label]="theme.isDarkMode() ? 'Switch to Light Mode' : 'Switch to Dark Mode'">
      <div class="switch-track" [class.is-dark]="theme.isDarkMode()">
        <div class="switch-thumb">
          <i class="bi" [class.bi-moon-fill]="theme.isDarkMode()" [class.bi-sun-fill]="!theme.isDarkMode()"></i>
        </div>
      </div>
    </button>
  `,
  styles: [`
    .theme-switch {
      background: transparent;
      border: none;
      padding: 0;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      outline: none;
    }
    .switch-track {
      width: 48px;
      height: 26px;
      background: var(--bg-elevated);
      border: 1px solid var(--border-color);
      border-radius: 20px;
      position: relative;
      transition: all 0.3s ease;
      box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);
    }
    .switch-track.is-dark {
      background: #1B4FFF;
      border-color: #1B4FFF;
    }
    .switch-thumb {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 20px;
      height: 20px;
      background: #FFFFFF;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    .switch-track.is-dark .switch-thumb {
      transform: translateX(22px);
    }
    /* RTL Support */
    html[dir="rtl"] .switch-track.is-dark .switch-thumb {
      transform: translateX(-22px);
    }
    .switch-thumb i {
      font-size: 12px;
      color: #F59E0B; /* Sun color */
      transition: color 0.3s;
    }
    .switch-track.is-dark .switch-thumb i {
      color: #1B4FFF; /* Moon color */
    }
  `]
})
export class ThemeToggle {
  theme = inject(ThemeService);
}
