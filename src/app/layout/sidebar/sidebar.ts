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

const ROLE_MENU_MAP: Record<string, NavItem[]> = {
  receptionist: [
    { icon: 'bi bi-grid-1x2', labelKey: 'SIDEBAR.DASHBOARD', route: '/receptionist/dashboard' },
    { icon: 'bi bi-people', labelKey: 'SIDEBAR.PATIENTS', route: '/receptionist/patients', badge: 3 },
    { icon: 'bi bi-calendar3', labelKey: 'SIDEBAR.BOOKINGS', route: '/receptionist/bookings' },
    { icon: 'bi bi-building', labelKey: 'SIDEBAR.ROOMS', route: '/receptionist/rooms' },
    { icon: 'bi bi-shield-check', labelKey: 'SIDEBAR.INSURANCE', route: '/receptionist/insurance', badge: 2 },
    { icon: 'bi bi-receipt', labelKey: 'SIDEBAR.BILLING', route: '/receptionist/billing' },
  ],
  senior: [
    { icon: 'bi bi-activity', labelKey: 'SIDEBAR.DASHBOARD', route: '/senior/dashboard' },
    { icon: 'bi bi-clipboard2-pulse', labelKey: 'SIDEBAR.ASSESSMENTS', route: '/senior/assessment-form' },
    { icon: 'bi bi-arrow-repeat', labelKey: 'SIDEBAR.REASSESSMENTS', route: '/senior/re-assessment-form' },
    { icon: 'bi bi-person-fill-slash', labelKey: 'SIDEBAR.ABSENCE_COVERAGE', route: '/senior/absence-coverage' },
  ],
  doctor: [
    { icon: 'bi bi-grid-1x2', labelKey: 'SIDEBAR.DASHBOARD', route: '/doctor/dashboard' },
    { icon: 'bi bi-calendar-event', labelKey: 'SIDEBAR.TODAYS_SCHEDULE', route: '/doctor' },
    { icon: 'bi bi-people', labelKey: 'SIDEBAR.MY_PATIENTS', route: '/doctor/patients' },
    { icon: 'bi bi-journal-medical', labelKey: 'SIDEBAR.SESSION_NOTES', route: '/doctor/session-notes' },
  ],
  ceo: [
    { icon: 'bi bi-grid-1x2', labelKey: 'SIDEBAR.OVERVIEW', route: '/ceo' },
    { icon: 'bi bi-person-badge', labelKey: 'SIDEBAR.STAFF', route: '/ceo/staff' },
    { icon: 'bi bi-graph-up', labelKey: 'SIDEBAR.REPORTS', route: '/ceo/reports' },
    { icon: 'ti ti-settings-2', labelKey: 'SIDEBAR.SYSTEM_SETTINGS', route: '/ceo/settings' },
  ]
};

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
    const normalizedRole = role ? role.toLowerCase() : '';
    return ROLE_MENU_MAP[normalizedRole] || [];
  });

  onMouseEnter() {
    this.isHovered.set(true);
  }

  onMouseLeave() {
    this.isHovered.set(false);
  }
}
