import { AsyncPipe, DatePipe, NgClass } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink, RouterLinkActive } from '@angular/router';
import { AuditService } from '../../core/services/audit.service';
import { SystemService } from '../../core/services/system.service';
import { UserService } from '../../core/services/user.service';

@Component({
  selector: 'app-admin-console',
  imports: [AsyncPipe, DatePipe, NgClass, RouterLink, RouterLinkActive],
  templateUrl: './admin-console.component.html'
})
export class AdminConsoleComponent implements OnInit {
  readonly route = inject(ActivatedRoute);
  private readonly systemService = inject(SystemService);
  private readonly userService = inject(UserService);
  private readonly auditService = inject(AuditService);

  readonly systems$ = this.systemService.systems$;
  readonly users$ = this.userService.users$;
  readonly logs$ = this.auditService.auditLogs$;
  ngOnInit(): void {
    this.systemService.loadSystems().subscribe();
    this.userService.loadUsers().subscribe();
    this.auditService.loadAuditLogs().subscribe();
  }
}
