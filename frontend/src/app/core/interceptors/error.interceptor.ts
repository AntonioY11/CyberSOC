import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';

export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const notifications = inject(NotificationService);
  const authService = inject(AuthService);
  const router = inject(Router);

  return next(request).pipe(catchError((error: unknown) => handleRequestError(error, request, next, authService, notifications, router)));
};

function handleRequestError(
  error: unknown,
  request: Parameters<HttpInterceptorFn>[0],
  next: Parameters<HttpInterceptorFn>[1],
  authService: AuthService,
  notifications: NotificationService,
  router: Router
) {
  if (!(error instanceof HttpErrorResponse)) {
    return throwError(() => error);
  }

  const isLoginRequest = request.url.includes('/auth/login/');
  const isRefreshRequest = request.url.includes('/token/refresh/');

  if (isLoginRequest) {
    return throwError(() => error);
  }

  if (error.status === 0) {
    notifications.notify('The SOC API is unavailable. Please try again when the backend is online.');
    return throwError(() => error);
  }

  if (error.status === 401) {
    if (isRefreshRequest) {
      authService.logout();
      notifications.notify('Your SOC session expired. Please sign in again.');
      void router.navigate(['/login']);
      return throwError(() => error);
    }

    return authService.refreshAccessToken().pipe(
      switchMap((accessToken) =>
        next(
          request.clone({
            setHeaders: {
              Authorization: `Bearer ${accessToken}`
            }
          })
        ).pipe(
          catchError((retryError: unknown) => {
            if (retryError instanceof HttpErrorResponse && retryError.status === 401) {
              authService.logout();
              notifications.notify('Your SOC session expired. Please sign in again.');
              void router.navigate(['/login']);
            }

            return throwError(() => retryError);
          })
        )
      ),
      catchError((refreshError: unknown) => {
        authService.logout();
        notifications.notify('Your SOC session expired. Please sign in again.');
        void router.navigate(['/login']);
        return throwError(() => refreshError);
      })
    );
  }

  if (error.status >= 500) {
    notifications.notify('The SOC API is temporarily unavailable. Please try again shortly.');
  } else if (error.status !== 0) {
    notifications.notify(resolveErrorMessage(error) ?? 'The request could not be completed.');
  }

  return throwError(() => error);
}

function resolveErrorMessage(error: HttpErrorResponse): string | null {
  const payload = error.error;

  if (typeof payload === 'string' && payload.trim()) {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }

    for (const value of Object.values(payload as Record<string, unknown>)) {
      if (typeof value === 'string' && value.trim()) {
        return value;
      }
      if (Array.isArray(value) && value.length && typeof value[0] === 'string') {
        return value[0];
      }
    }
  }

  return null;
}
