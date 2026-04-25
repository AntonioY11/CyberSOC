import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';

export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const notifications = inject(NotificationService);
  const authService = inject(AuthService);
  const router = inject(Router);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        if (error.status === 401) {
          authService.logout();
          notifications.notify('Your SOC session expired. Please sign in again.');
          void router.navigate(['/login']);
        } else if (error.status >= 500) {
          notifications.notify('The SOC API is temporarily unavailable. Demo data remains active.');
        } else if (error.status !== 0) {
          notifications.notify(error.error?.detail ?? 'The request could not be completed.');
        }
      }

      return throwError(() => error);
    })
  );
};
