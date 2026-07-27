import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService, UserRole } from '../../core/services/auth';

interface NavItem {
  icon: string;
  labelEn: string;
  labelAr: string;
  route: string;
  badge?: number;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {
  auth = inject(AuthService);
  
  isHovered = signal(false);
  isMobileOpen = signal(false);

  navItems = computed<NavItem[]>(() => {
    const role = this.auth.currentRole();
    switch (role) {
      case 'Receptionist':
        return [
          { icon: 'bi-speedometer2', labelEn: 'Dashboard', labelAr: 'لوحة التحكم', route: '/receptionist' },
          { icon: 'bi-people', labelEn: 'Patients', labelAr: 'المرضى', route: '/receptionist/patients', badge: 3 },
          { icon: 'bi-calendar-event', labelEn: 'Bookings', labelAr: 'الحجوزات', route: '/receptionist/bookings' },
        ];
      case 'Senior Therapist':
        return [
          { icon: 'bi-speedometer2', labelEn: 'Dashboard', labelAr: 'لوحة التحكم', route: '/senior' },
          { icon: 'bi-clipboard-check', labelEn: 'Assessments', labelAr: 'التقييمات', route: '/senior/assessments', badge: 5 },
        ];
      case 'Doctor':
        return [
          { icon: 'bi-calendar3', labelEn: 'Today\'s Schedule', labelAr: 'جدول اليوم', route: '/doctor' },
          { icon: 'bi-person-lines-fill', labelEn: 'My Patients', labelAr: 'مرضاي', route: '/doctor/patients' },
        ];
      case 'CEO':
        return [
          { icon: 'bi-speedometer2', labelEn: 'Overview', labelAr: 'نظرة عامة', route: '/ceo' },
          { icon: 'bi-people', labelEn: 'Staff', labelAr: 'الموظفون', route: '/ceo/staff' },
          { icon: 'bi-bar-chart', labelEn: 'Reports', labelAr: 'التقارير', route: '/ceo/reports' },
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
