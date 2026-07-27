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
      { path: 'receptionist', loadComponent: () => import('./features/receptionist/dashboard/dashboard').then(m => m.Dashboard) },
      { path: 'senior', loadComponent: () => import('./features/senior/dashboard/dashboard').then(m => m.Dashboard) },
      { path: 'doctor', loadComponent: () => import('./features/doctor/dashboard/dashboard').then(m => m.Dashboard) },
      { path: 'ceo', loadComponent: () => import('./features/ceo/dashboard/dashboard').then(m => m.Dashboard) },
    ]
  },
  { path: '**', redirectTo: 'login' }
];
