import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService, UserRole } from '../../core/services/auth';
import { LanguageService } from '../../core/services/language';
import { TranslateModule } from '@ngx-translate/core';

interface NavItem {
  icon: string;
  labelKey: string;
  route: string;
  badge?: number;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {
  auth = inject(AuthService);
  langService = inject(LanguageService);
  
  isHovered = signal(false);
  isMobileOpen = signal(false);

  navItems = computed<NavItem[]>(() => {
    const role = this.auth.currentRole();
    switch (role) {
      case 'Receptionist':
        return [
          { icon: 'bi-speedometer2', labelKey: 'SIDEBAR.DASHBOARD', route: '/receptionist' },
          { icon: 'bi-people', labelKey: 'SIDEBAR.PATIENTS', route: '/receptionist/patients', badge: 3 },
          { icon: 'bi-calendar-event', labelKey: 'SIDEBAR.BOOKINGS', route: '/receptionist/bookings' },
        ];
      case 'Senior Therapist':
        return [
          { icon: 'bi-speedometer2', labelKey: 'SIDEBAR.DASHBOARD', route: '/senior' },
          { icon: 'bi-clipboard-check', labelKey: 'SIDEBAR.ASSESSMENTS', route: '/senior/assessments', badge: 5 },
        ];
      case 'Doctor':
        return [
          { icon: 'bi-calendar3', labelKey: 'SIDEBAR.TODAYS_SCHEDULE', route: '/doctor' },
          { icon: 'bi-person-lines-fill', labelKey: 'SIDEBAR.MY_PATIENTS', route: '/doctor/patients' },
        ];
      case 'CEO':
        return [
          { icon: 'bi-speedometer2', labelKey: 'SIDEBAR.OVERVIEW', route: '/ceo' },
          { icon: 'bi-people', labelKey: 'SIDEBAR.STAFF', route: '/ceo/staff' },
          { icon: 'bi-bar-chart', labelKey: 'SIDEBAR.REPORTS', route: '/ceo/reports' },
        ];
      default:
        return [];
    }
  });

  onMouseEnter() {
    this.isHovered.set(true);
  }

  onMouseLeave() {
    this.isHovered.set(false);
  }
}
