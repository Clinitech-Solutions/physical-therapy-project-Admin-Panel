import { Routes } from '@angular/router';
import { Login } from './features/auth/login/login';
import { AppLayoutComponent } from './layout/app-layout/app-layout';
import { authGuard } from './core/guards/auth-guard';
import { roleGuard } from './core/guards/role-guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: Login },
  { 
    path: '', 
    component: AppLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'receptionist/dashboard', loadComponent: () => import('./features/receptionist/dashboard/dashboard').then(m => m.Dashboard), canActivate: [roleGuard], data: { roles: ['Receptionist', 'CEO'] } },
      { path: 'receptionist/patients', loadComponent: () => import('./features/receptionist/patients/patients').then(m => m.PatientsComponent), canActivate: [roleGuard], data: { roles: ['Receptionist', 'CEO'] } },
      { path: 'receptionist/bookings', loadComponent: () => import('./features/receptionist/bookings/bookings').then(m => m.BookingsComponent), canActivate: [roleGuard], data: { roles: ['Receptionist', 'CEO'] } },
      { path: 'receptionist/rooms', loadComponent: () => import('./features/receptionist/rooms/rooms').then(m => m.RoomsComponent), canActivate: [roleGuard], data: { roles: ['Receptionist', 'CEO'] } },
      { path: 'receptionist/insurance', loadComponent: () => import('./features/receptionist/insurance/insurance').then(m => m.InsuranceComponent), canActivate: [roleGuard], data: { roles: ['Receptionist', 'CEO'] } },
      { path: 'receptionist/billing', loadComponent: () => import('./features/receptionist/billing/billing').then(m => m.BillingComponent), canActivate: [roleGuard], data: { roles: ['Receptionist', 'CEO'] } },
      
      // ── Senior Therapist Routes ──
      { path: 'senior/dashboard', loadComponent: () => import('./features/senior/live-dashboard/live-dashboard').then(m => m.LiveDashboard), canActivate: [roleGuard], data: { roles: ['Senior Therapist', 'CEO'] } },
      { path: 'senior/assessment-form', loadComponent: () => import('./features/senior/assessment-form/assessment-form').then(m => m.AssessmentForm), canActivate: [roleGuard], data: { roles: ['Senior Therapist', 'CEO'] } },
      { path: 'senior/re-assessment-form', loadComponent: () => import('./features/senior/re-assessment-form/re-assessment-form').then(m => m.ReAssessmentForm), canActivate: [roleGuard], data: { roles: ['Senior Therapist', 'CEO'] } },
      { path: 'senior/absence-coverage', loadComponent: () => import('./features/senior/absence-coverage/absence-coverage').then(m => m.AbsenceCoverage), canActivate: [roleGuard], data: { roles: ['Senior Therapist', 'CEO'] } },
      // ── Doctor Routes ──
      { path: 'doctor', redirectTo: 'doctor/dashboard', pathMatch: 'full' },
      { path: 'doctor/dashboard', loadComponent: () => import('./features/doctor/dashboard/dashboard').then(m => m.Dashboard), canActivate: [roleGuard], data: { roles: ['Doctor', 'CEO'] } },
      { path: 'doctor/session-notes/:sessionId', loadComponent: () => import('./features/doctor/dashboard/dashboard').then(m => m.Dashboard), canActivate: [roleGuard], data: { roles: ['Doctor', 'CEO'] } }, // TODO: Replace with SessionNotes component when created
      { path: 'ceo', loadComponent: () => import('./features/ceo/dashboard/dashboard').then(m => m.Dashboard), canActivate: [roleGuard], data: { roles: ['CEO'] } },
      { path: 'ceo/staff', loadComponent: () => import('./features/ceo/staff-management/staff-list/staff-list.component').then(m => m.StaffListComponent), canActivate: [roleGuard], data: { roles: ['CEO'] } },
    ]
  },
  { path: '**', redirectTo: 'login' }
];


