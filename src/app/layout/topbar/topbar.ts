import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../core/services/theme';
import { LanguageService } from '../../core/services/language';
import { AuthService } from '../../core/services/auth';
import { ThemeToggle } from '../../shared/components/theme-toggle/theme-toggle';
import { LanguageSelector } from '../../shared/components/language-selector/language-selector';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, ThemeToggle, LanguageSelector, TranslateModule],
  templateUrl: './topbar.html',
  styleUrl: './topbar.css',
})
export class Topbar {
  themeService = inject(ThemeService);
  langService = inject(LanguageService);
  authService = inject(AuthService);

  getRoleKey(role: string | null): string {
    if (!role) return '';
    if (role === 'Senior Therapist') return 'ROLES.SENIOR';
    return `ROLES.${role.toUpperCase()}`;
  }
}
