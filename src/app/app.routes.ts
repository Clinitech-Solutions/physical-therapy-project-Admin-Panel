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
      { path: 'receptionist/walk-in', loadComponent: () => import('./features/receptionist/walk-in/walk-in').then(m => m.WalkInComponent) },
      { path: 'receptionist/rooms', loadComponent: () => import('./features/receptionist/rooms/rooms').then(m => m.RoomsComponent) },
      { path: 'receptionist/insurance', loadComponent: () => import('./features/receptionist/insurance/insurance').then(m => m.InsuranceComponent) },
      { path: 'receptionist/billing', loadComponent: () => import('./features/receptionist/billing/billing').then(m => m.BillingComponent) },
      
      { path: 'senior', loadComponent: () => import('./features/senior/dashboard/dashboard').then(m => m.Dashboard) },
      { path: 'doctor', loadComponent: () => import('./features/doctor/dashboard/dashboard').then(m => m.Dashboard) },
      { path: 'ceo', loadComponent: () => import('./features/ceo/dashboard/dashboard').then(m => m.Dashboard) },
    ]
  },
  { path: '**', redirectTo: 'login' }
];
