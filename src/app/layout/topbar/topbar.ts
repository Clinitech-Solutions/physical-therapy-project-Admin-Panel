import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../core/services/theme';
import { LanguageService } from '../../core/services/language';
import { AuthService } from '../../core/services/auth';
import { ThemeToggle } from '../../shared/components/theme-toggle/theme-toggle';
import { LanguageSelector } from '../../shared/components/language-selector/language-selector';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, ThemeToggle, LanguageSelector],
  templateUrl: './topbar.html',
  styleUrl: './topbar.css',
})
export class Topbar {
  themeService = inject(ThemeService);
  langService = inject(LanguageService);
  authService = inject(AuthService);
}
