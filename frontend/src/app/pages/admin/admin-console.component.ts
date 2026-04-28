import { AsyncPipe, DatePipe, NgClass } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink, RouterLinkActive } from '@angular/router';
import { AuditService } from '../../core/services/audit.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { SystemService } from '../../core/services/system.service';
import { UserService } from '../../core/services/user.service';
import { AddAssetModalComponent } from './add-asset-modal.component';
import { InviteUserModalComponent } from './invite-user-modal.component';

@Component({
  selector: 'app-admin-console',
  imports: [AddAssetModalComponent, AsyncPipe, DatePipe, InviteUserModalComponent, NgClass, RouterLink, RouterLinkActive],
  templateUrl: './admin-console.component.html'
})
export class AdminConsoleComponent implements OnInit {
  readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly notifications = inject(NotificationService);
  private readonly systemService = inject(SystemService);
  private readonly userService = inject(UserService);
  private readonly auditService = inject(AuditService);

  readonly systems$ = this.systemService.systems$;
  readonly users$ = this.userService.users$;
  readonly logs$ = this.auditService.auditLogs$;
  inviteModalOpen = false;
  assetModalOpen = false;
  pendingDeleteUser: { id: string; email: string } | null = null;
  pendingDeleteSystem: { id: string; name: string; ipAddress: string } | null = null;
  deletingUserId: string | null = null;
  deletingSystemId: string | null = null;

  ngOnInit(): void {
    this.systemService.loadSystems().subscribe();
    this.userService.loadUsers().subscribe();
    this.auditService.loadAuditLogs().subscribe();
  }

  openInviteModal(): void {
    this.inviteModalOpen = true;
  }

  closeInviteModal(): void {
    this.inviteModalOpen = false;
  }

  openAssetModal(): void {
    this.assetModalOpen = true;
  }

  closeAssetModal(): void {
    this.assetModalOpen = false;
  }

  refreshUsersAndAudit(): void {
    this.userService.loadUsers().subscribe();
    this.auditService.loadAuditLogs().subscribe();
  }

  refreshSystemsAndAudit(): void {
    this.systemService.loadSystems().subscribe();
    this.auditService.loadAuditLogs().subscribe();
  }

  isCurrentUser(userId: string): boolean {
    return this.authService.currentUser?.id === userId;
  }

  requestDeleteUser(userId: string, email: string): void {
    if (this.isCurrentUser(userId)) {
      this.notifications.notify('You cannot delete your own admin account.');
      return;
    }

    this.pendingDeleteUser = { id: userId, email };
  }

  cancelDeleteUser(): void {
    this.pendingDeleteUser = null;
  }

  confirmDeleteUser(): void {
    const user = this.pendingDeleteUser;
    if (!user) {
      return;
    }

    this.deletingUserId = user.id;
    this.userService.deleteUser(user.id).subscribe(() => {
      this.notifications.notify(`${user.email} was deleted.`);
      this.pendingDeleteUser = null;
      this.deletingUserId = null;
      this.refreshUsersAndAudit();
    });
  }

  requestDeleteSystem(systemId: string, name: string, ipAddress: string): void {
    this.pendingDeleteSystem = { id: systemId, name, ipAddress };
  }

  cancelDeleteSystem(): void {
    this.pendingDeleteSystem = null;
  }

  confirmDeleteSystem(): void {
    const system = this.pendingDeleteSystem;
    if (!system) {
      return;
    }

    this.deletingSystemId = system.id;
    this.systemService.deleteSystem(system.id).subscribe(() => {
      this.notifications.notify(`${system.name} was deleted.`);
      this.pendingDeleteSystem = null;
      this.deletingSystemId = null;
      this.refreshSystemsAndAudit();
    });
  }
}
