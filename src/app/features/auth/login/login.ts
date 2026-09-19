import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
  imports: [CommonModule, ThemeToggle, LanguageSelector, TranslateModule, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  authService = inject(AuthService);
  themeService = inject(ThemeService);
  langService = inject(LanguageService);
  messageService = inject(MessageService);
  router = inject(Router);
  fb = inject(FormBuilder);

  isSubmitting = signal(false);

  loginForm: FormGroup = this.fb.group({
    userName: ['', Validators.required],
    password: ['', Validators.required]
  });

  submit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    const loginData = {
      email: this.loginForm.value.userName, // Auth service interface expects email
      password: this.loginForm.value.password,
      userName: this.loginForm.value.userName
    };

    this.authService.login(loginData).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        const user = this.authService.currentUser();
        const role = user?.roles?.[0];

        this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Logged in successfully' });

        if (role === 'CEO') this.router.navigate(['/ceo']);
        else if (role === 'Senior Therapist') this.router.navigate(['/senior/dashboard']);
        else if (role === 'Doctor') this.router.navigate(['/doctor']);
        else if (role === 'Receptionist') this.router.navigate(['/receptionist/dashboard']);
        else this.router.navigate(['/']);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Invalid credentials or login failed.' });
      }
    });
  }
}
