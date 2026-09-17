import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService, UserRole } from '../../../core/services/auth';
import { ThemeService } from '../../../core/services/theme';
import { LanguageService } from '../../../core/services/language';
import { MessageService } from 'primeng/api';
import { ThemeToggle } from '../../../shared/components/theme-toggle/theme-toggle';
import { LanguageSelector } from '../../../shared/components/language-selector/language-selector';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ThemeToggle, LanguageSelector, TranslateModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  authService = inject(AuthService);
  themeService = inject(ThemeService);
  langService = inject(LanguageService);
  messageService = inject(MessageService);
  router = inject(Router);

  onLogin(role: UserRole) {
    this.authService.login(role);
    this.messageService.add({ severity: 'success', summary: 'Success', detail: `Logged in as ${role}` });
    if (role === 'Receptionist') this.router.navigate(['/receptionist/dashboard']);
    else if (role === 'Senior Therapist') this.router.navigate(['/senior/dashboard']);
    else if (role === 'Doctor') this.router.navigate(['/doctor']);
    else if (role === 'CEO') this.router.navigate(['/ceo']);
  }
}
