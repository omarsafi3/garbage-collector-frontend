import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Role } from '../models/auth.model';

export const roleGuard = (allowedRoles: Role[]): CanActivateFn => {
  return (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.isAuthenticated()) {
      router.navigate(['/login']);
      return false;
    }

    const user = authService.getCurrentUser();
    if (user && allowedRoles.includes(user.role as Role)) {
      return true;
    }

    // Redirect to appropriate dashboard based on role
    if (authService.isSuperAdmin()) {
      router.navigate(['/admin']);
    } else {
      router.navigate(['/dashboard']);
    }
    
    return false;
  };
};
