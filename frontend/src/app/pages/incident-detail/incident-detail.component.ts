import { AsyncPipe, DatePipe, NgClass } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, map } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Incident, IncidentLog, IncidentSeverity, IncidentStatus, SocUser } from '../../core/models/soc.models';
import { AuthService } from '../../core/services/auth.service';
import { IncidentService } from '../../core/services/incident.service';
import { NotificationService } from '../../core/services/notification.service';
import { UserService } from '../../core/services/user.service';

@Component({
  selector: 'app-incident-detail',
  imports: [AsyncPipe, DatePipe, NgClass, ReactiveFormsModule, RouterLink],
  templateUrl: './incident-detail.component.html'
})
export class IncidentDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly incidentService = inject(IncidentService);
  private readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly notifications = inject(NotificationService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly user$ = this.authService.user$;
  readonly incident$ = combineLatest([this.route.paramMap, this.incidentService.incidents$]).pipe(
    map(([params, incidents]) => incidents.find((incident) => incident.id === params.get('id')))
  );

  readonly statuses: IncidentStatus[] = ['NEW', 'ASSIGNED', 'MITIGATED', 'RESOLVED'];
  readonly severities: IncidentSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  readonly form = this.formBuilder.nonNullable.group(
    {
      status: ['NEW' as IncidentStatus, Validators.required],
      severity: ['LOW' as IncidentSeverity, Validators.required],
      resolutionSummary: ['']
    },
    { validators: [this.resolutionSummaryRequired.bind(this)] }
  );

  currentIncident: Incident | null = null;
  isEditable = false;
  isAdmin = false;
  canClaimIncident = false;
  canManageStatus = false;
  analysts: SocUser[] = [];
  analystSearchTerm = '';
  selectedAnalystId = '';
  submitting = false;

  ngOnInit(): void {
    this.incidentService.loadIncidents().subscribe();
    if (this.authService.currentUser?.role === 'ADMIN') {
      this.userService.loadAdminAnalysts().subscribe((analysts) => {
        const currentUserId = this.authService.currentUser?.id;
        this.analysts = analysts.filter((analyst) => analyst.id !== currentUserId);
      });
    }

    combineLatest([this.incident$, this.user$])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([incident, user]) => {
        if (!incident) {
          this.currentIncident = null;
          this.isEditable = false;
          this.canClaimIncident = false;
          this.canManageStatus = false;
          return;
        }

        this.currentIncident = incident;
        this.isAdmin = user?.role === 'ADMIN';
        this.canManageStatus = this.isAdmin || incident.assignedTo?.id === user?.id;
        this.canClaimIncident = incident.status === 'NEW' && !incident.assignedTo && user?.role === 'ANALYST';
        this.selectedAnalystId = incident.assignedTo?.id ?? this.selectedAnalystId;
        this.form.reset(
          {
            status: incident.status,
            severity: incident.severity,
            resolutionSummary: incident.resolutionSummary
          },
          { emitEvent: false }
        );

        this.isEditable = this.canManageStatus;
        if (this.isEditable) {
          this.form.enable({ emitEvent: false });
        } else {
          this.form.disable({ emitEvent: false });
        }

        this.form.markAsPristine();
        this.form.markAsUntouched();
      });
  }

  sortedLogs(logs: IncidentLog[]): IncidentLog[] {
    return [...logs].sort((first, second) => Date.parse(second.timestamp) - Date.parse(first.timestamp));
  }

  severityClass(severity: IncidentSeverity): string {
    return severity.toLowerCase();
  }

  assigneeInitials(assignee: SocUser | null): string {
    if (!assignee) {
      return '';
    }

    return assignee.name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  }

  filteredAnalysts(): SocUser[] {
    const query = this.analystSearchTerm.trim().toLowerCase();
    const eligibleAnalysts = this.analysts.filter((analyst) => analyst.id !== this.authService.currentUser?.id);
    return query ? eligibleAnalysts.filter((analyst) => analyst.name.toLowerCase().includes(query)) : eligibleAnalysts;
  }

  selectAnalyst(analystId: string): void {
    this.selectedAnalystId = analystId;
  }

  claimIncident(): void {
    if (!this.currentIncident || !this.canClaimIncident) {
      return;
    }

    this.incidentService.claimIncident(this.currentIncident.id).subscribe(() => {
      this.notifications.notify('Incident claimed successfully.');
    });
  }

  assignIncident(): void {
    if (!this.currentIncident || !this.isAdmin || !this.selectedAnalystId) {
      return;
    }

    this.incidentService.assignIncidentToAnalyst(this.currentIncident.id, this.selectedAnalystId).subscribe(() => {
      const analyst = this.filteredAnalysts().find((candidate) => candidate.id === this.selectedAnalystId);
      this.notifications.notify(`Incident assigned to ${analyst?.name ?? 'selected analyst'}.`);
    });
  }

  selectStatus(status: IncidentStatus): void {
    if (!this.isEditable) {
      return;
    }

    this.form.controls.status.setValue(status);
    this.form.controls.status.markAsDirty();
    this.form.updateValueAndValidity();
  }

  submit(): void {
    if (!this.currentIncident || !this.isEditable) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const rawValue = this.form.getRawValue();
    this.submitting = true;
    this.incidentService
      .updateIncidentStatus(this.currentIncident.id, {
        status: rawValue.status,
        severity: rawValue.severity,
        resolutionSummary: rawValue.status === 'RESOLVED' ? rawValue.resolutionSummary.trim() : rawValue.resolutionSummary.trim() || undefined
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notifications.notify('Incident status updated.');
          void this.router.navigate(['/incidents']);
          this.submitting = false;
        },
        error: () => {
          this.submitting = false;
        }
      });
  }

  private resolutionSummaryRequired(control: AbstractControl): ValidationErrors | null {
    const status = control.get('status')?.value as IncidentStatus | null;
    const summary = String(control.get('resolutionSummary')?.value ?? '').trim();

    if (status === 'RESOLVED' && !summary) {
      return { resolutionSummaryRequired: true };
    }

    return null;
  };

  statusButtonDisabled(status: IncidentStatus): boolean {
    return !!this.currentIncident && !this.currentIncident.assignedTo && status !== 'NEW';
  }
}
