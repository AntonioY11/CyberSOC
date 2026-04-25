import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html'
})
export class LoginComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly notifications = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  loading = false;
  errorMessage = '';

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.authService.logout();
    this.authService.login(this.form.getRawValue()).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';
        void this.router.navigateByUrl(returnUrl);
      },
      error: (error: unknown) => {
        this.loading = false;
        this.errorMessage = this.loginErrorMessage(error);
        this.notifications.notify(this.errorMessage);
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  private loginErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) {
        return this.extractBackendMessage(error) ?? 'Invalid email or password.';
      }

      if (error.status === 0 || error.status >= 500) {
        return 'The SOC API is unavailable. Please try again when the backend is online.';
      }

      return this.extractBackendMessage(error) ?? 'Sign in could not be completed.';
    }

    return 'Sign in could not be completed.';
  }

  private extractBackendMessage(error: HttpErrorResponse): string | null {
    const detail = error.error?.detail;
    return typeof detail === 'string' && detail.trim() ? detail : null;
  }
}
