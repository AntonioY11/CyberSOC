import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const jwtInterceptor: HttpInterceptorFn = (request, next) => {
  const token = inject(AuthService).token;
  const isApiRequest = request.url.startsWith('http://127.0.0.1:8000/api') || request.url.startsWith('/api');
  const isLoginRequest = request.url.includes('/auth/login/');

  if (!token || !isApiRequest || isLoginRequest) {
    return next(request);
  }

  return next(
    request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    })
  );
};
