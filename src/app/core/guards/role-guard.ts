import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth';
import { UserRole } from '../models/auth.model';

export const roleGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  const expectedRoles = route.data['roles'] as UserRole[];
  
  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  const hasRole = expectedRoles.some(role => authService.hasRole(role));
  
  if (hasRole) {
    return true;
  }

  // Not authorized, maybe redirect to unauthorized or home page
  return router.createUrlTree(['/']);
};
