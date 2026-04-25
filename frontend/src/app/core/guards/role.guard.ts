import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  CanActivateChild,
  Router,
  RouterStateSnapshot,
  UrlTree
} from '@angular/router';
import { UserRole } from '../models/soc.models';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class RoleGuard implements CanActivate, CanActivateChild {
  constructor(
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree {
    return this.authorize(route, state.url);
  }

  canActivateChild(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree {
    return this.authorize(route, state.url);
  }

  private authorize(route: ActivatedRouteSnapshot, requestedUrl: string): boolean | UrlTree {
    const sessionUser = this.authService.currentUser;

    if (!sessionUser) {
      return this.router.createUrlTree(['/login'], { queryParams: { returnUrl: requestedUrl } });
    }

    const roles = (route.data['roles'] as UserRole[] | undefined) ?? ['ADMIN', 'ANALYST'];
    return roles.includes(sessionUser.role) ? true : this.router.createUrlTree(['/dashboard']);
  }
}
