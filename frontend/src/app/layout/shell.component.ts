import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { NotificationService } from '../core/services/notification.service';
import { ChangePasswordModalComponent } from './change-password-modal.component';

@Component({
  selector: 'app-shell',
  imports: [AsyncPipe, ChangePasswordModalComponent, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './shell.component.html'
})
export class ShellComponent {
  private readonly authService = inject(AuthService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

  readonly user$ = this.authService.user$;
  readonly messages$ = this.notifications.messages$;
  passwordModalOpen = false;

  openPasswordModal(): void {
    this.passwordModalOpen = true;
  }

  closePasswordModal(): void {
    this.passwordModalOpen = false;
  }

  onPasswordChanged(): void {
    this.notifications.notify('Your password was changed successfully.');
  }

  logout(): void {
    this.authService.logout();
    void this.router.navigate(['/login']);
  }

  dismiss(index: number): void {
    this.notifications.dismiss(index);
  }
}
