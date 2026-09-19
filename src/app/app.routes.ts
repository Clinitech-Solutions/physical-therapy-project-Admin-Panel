import { Routes } from '@angular/router';
import { Login } from './features/auth/login/login';
import { AppLayoutComponent } from './layout/app-layout/app-layout';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: Login },
  { 
    path: '', 
    component: AppLayoutComponent,
    // TODO: Add AuthGuard here
    children: [
      { path: 'receptionist/dashboard', loadComponent: () => import('./features/receptionist/dashboard/dashboard').then(m => m.Dashboard) },
      { path: 'receptionist/patients', loadComponent: () => import('./features/receptionist/patients/patients').then(m => m.PatientsComponent) },
      { path: 'receptionist/bookings', loadComponent: () => import('./features/receptionist/bookings/bookings').then(m => m.BookingsComponent) },
      { path: 'receptionist/rooms', loadComponent: () => import('./features/receptionist/rooms/rooms').then(m => m.RoomsComponent) },
      { path: 'receptionist/insurance', loadComponent: () => import('./features/receptionist/insurance/insurance').then(m => m.InsuranceComponent) },
      { path: 'receptionist/billing', loadComponent: () => import('./features/receptionist/billing/billing').then(m => m.BillingComponent) },
      
      // ── Senior Therapist Routes ──
      { path: 'senior/dashboard', loadComponent: () => import('./features/senior/live-dashboard/live-dashboard').then(m => m.LiveDashboard) },
      { path: 'senior/assessment-form', loadComponent: () => import('./features/senior/assessment-form/assessment-form').then(m => m.AssessmentForm) },
      { path: 'senior/re-assessment-form', loadComponent: () => import('./features/senior/re-assessment-form/re-assessment-form').then(m => m.ReAssessmentForm) },
      { path: 'senior/absence-coverage', loadComponent: () => import('./features/senior/absence-coverage/absence-coverage').then(m => m.AbsenceCoverage) },
      // ── Doctor Routes ──
      { path: 'doctor', redirectTo: 'doctor/dashboard', pathMatch: 'full' },
      { path: 'doctor/dashboard', loadComponent: () => import('./features/doctor/dashboard/dashboard').then(m => m.Dashboard) },
      { path: 'doctor/session-notes/:sessionId', loadComponent: () => import('./features/doctor/dashboard/dashboard').then(m => m.Dashboard) }, // TODO: Replace with SessionNotes component when created
      { path: 'ceo', loadComponent: () => import('./features/ceo/dashboard/dashboard').then(m => m.Dashboard) },
    ]
  },
  { path: '**', redirectTo: 'login' }
];
