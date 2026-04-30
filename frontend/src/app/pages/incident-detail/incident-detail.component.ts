import { AsyncPipe, DatePipe, NgClass } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, finalize, map } from 'rxjs';
import {
  IncidentArtifactType,
  IncidentArtifactUploadDraft,
  Incident,
  IncidentLog,
  IncidentSeverity,
  IncidentStatus,
  IncidentValidationStatus,
  SocUser
} from '../../core/models/soc.models';
import { AuthService } from '../../core/services/auth.service';
import { IncidentService } from '../../core/services/incident.service';
import { NotificationService } from '../../core/services/notification.service';

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
  private readonly notifications = inject(NotificationService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly user$ = this.authService.user$;
  readonly incident$ = combineLatest([this.route.paramMap, this.incidentService.incidents$]).pipe(
    map(([params, incidents]) => incidents.find((incident) => incident.id === params.get('id')))
  );

  readonly statuses: IncidentStatus[] = ['NEW', 'ASSIGNED', 'MITIGATED', 'RESOLVED'];
  readonly validationStatuses: IncidentValidationStatus[] = ['PENDING', 'TRUE_POSITIVE', 'FALSE_POSITIVE', 'BENIGN_POSITIVE'];
  readonly severities: IncidentSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  readonly form = this.formBuilder.nonNullable.group(
    {
      status: ['NEW' as IncidentStatus, Validators.required],
      severity: ['LOW' as IncidentSeverity, Validators.required],
      validationStatus: ['PENDING' as IncidentValidationStatus, Validators.required],
      resolutionSummary: ['']
    },
    { validators: [this.workflowValidator.bind(this)] }
  );

  currentIncident: Incident | null = null;
  canClaimIncident = false;
  canManageStatus = false;
  canDeleteIncident = false;
  canUploadFiles = false;
  pendingDeleteIncident = false;
  uploadingEvidence = false;
  uploadingReport = false;
  deletingEvidence = false;
  deletingReport = false;
  submitting = false;

  ngOnInit(): void {
    this.incidentService.loadIncidents().subscribe();

    combineLatest([this.incident$, this.user$])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([incident, user]) => {
        if (!incident) {
          this.currentIncident = null;
          this.canClaimIncident = false;
          this.canManageStatus = false;
          this.canDeleteIncident = false;
          this.canUploadFiles = false;
          this.pendingDeleteIncident = false;
          return;
        }

        const incidentChanged = this.currentIncident?.id !== incident.id;
        this.currentIncident = incident;
        const isAdmin = user?.role === 'ADMIN';
        const isOwner = incident.assignedTo?.id === user?.id;
        this.canManageStatus = isOwner;
        this.canDeleteIncident = user?.role === 'ADMIN';
        this.canUploadFiles = !this.isLocked() && (isAdmin || isOwner);
        this.canClaimIncident = incident.status === 'NEW' && !incident.assignedTo && !!user;

        if (!incidentChanged && this.form.dirty) {
          if (this.canManageStatus && !this.isLocked()) {
            this.form.enable({ emitEvent: false });
          } else {
            this.form.disable({ emitEvent: false });
          }

          return;
        }

        this.form.reset(
          {
            status: incident.status,
            severity: incident.severity,
            validationStatus: incident.validationStatus,
            resolutionSummary: incident.resolutionSummary
          },
          { emitEvent: false }
        );

        if (this.canManageStatus && !this.isLocked()) {
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

  validationClass(validationStatus: IncidentValidationStatus): string {
    return validationStatus.toLowerCase();
  }

  isLocked(): boolean {
    return this.currentIncident?.status === 'RESOLVED';
  }

  canReopen(): boolean {
    return this.isLocked() && this.authService.currentUser?.role === 'ADMIN';
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

  claimIncident(): void {
    if (!this.currentIncident || !this.canClaimIncident) {
      return;
    }

    this.incidentService.claimIncident(this.currentIncident.id).subscribe(() => {
      this.notifications.notify('Incident claimed successfully.');
    });
  }

  reopenIncident(): void {
    if (!this.currentIncident || !this.canReopen()) {
      return;
    }

    this.submitting = true;
    this.incidentService.reopenIncident(this.currentIncident.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.notifications.notify('Incident reopened successfully.');
        this.submitting = false;
      },
      error: () => {
        this.submitting = false;
      }
    });
  }

  deleteIncident(): void {
    if (!this.currentIncident || !this.canDeleteIncident) {
      return;
    }

    this.pendingDeleteIncident = true;
  }

  cancelDeleteIncident(): void {
    this.pendingDeleteIncident = false;
  }

  confirmDeleteIncident(): void {
    if (!this.currentIncident || !this.canDeleteIncident) {
      return;
    }

    this.submitting = true;
    this.incidentService.deleteIncident(this.currentIncident.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.notifications.notify('Incident soft-deleted.');
        this.submitting = false;
        this.pendingDeleteIncident = false;
        void this.router.navigate(['/incidents']);
      },
      error: () => {
        this.submitting = false;
      }
    });
  }

  uploadEvidenceImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0);
    input.value = '';

    if (!file) {
      return;
    }

    this.uploadIncidentArtifact({ evidenceImage: file }, 'uploadingEvidence', 'Evidence image updated.');
  }

  uploadForensicReport(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0);
    input.value = '';

    if (!file) {
      return;
    }

    this.uploadIncidentArtifact({ forensicReport: file }, 'uploadingReport', 'Forensic report updated.');
  }

  deleteEvidenceImage(): void {
    this.removeIncidentArtifact('evidence_image', 'deletingEvidence', 'Evidence image removed.');
  }

  deleteForensicReport(): void {
    this.removeIncidentArtifact('forensic_report', 'deletingReport', 'Forensic report removed.');
  }

  selectStatus(status: IncidentStatus): void {
    if (!this.canManageStatus || this.isLocked()) {
      return;
    }

    this.form.controls.status.setValue(status);
    if (status !== 'RESOLVED') {
      this.form.controls.validationStatus.setValue('PENDING');
    }
    this.form.controls.status.markAsDirty();
    this.form.updateValueAndValidity();
  }

  selectValidationStatus(validationStatus: IncidentValidationStatus): void {
    if (!this.canManageStatus || this.isLocked() || this.form.controls.status.value !== 'RESOLVED') {
      return;
    }

    this.form.controls.validationStatus.setValue(validationStatus);
    this.form.controls.validationStatus.markAsDirty();
    this.form.updateValueAndValidity();
  }

  submit(): void {
    if (!this.currentIncident || !this.canManageStatus || this.isLocked()) {
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
        validationStatus: rawValue.validationStatus,
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

  private workflowValidator(control: AbstractControl): ValidationErrors | null {
    const status = control.get('status')?.value as IncidentStatus | null;
    const validationStatus = control.get('validationStatus')?.value as IncidentValidationStatus | null;
    const summary = String(control.get('resolutionSummary')?.value ?? '').trim();

    if (status !== 'RESOLVED' && validationStatus !== 'PENDING') {
      return { validationStatusLocked: true };
    }

    if (status === 'RESOLVED' && !summary) {
      return { resolutionSummaryRequired: true };
    }

    if (status === 'RESOLVED' && validationStatus === 'PENDING') {
      return { validationStatusRequired: true };
    }

    return null;
  }

  statusButtonDisabled(status: IncidentStatus): boolean {
    return !this.canManageStatus || this.isLocked();
  }

  private uploadIncidentArtifact(
    draft: IncidentArtifactUploadDraft,
    stateKey: 'uploadingEvidence' | 'uploadingReport',
    successMessage: string
  ): void {
    if (!this.currentIncident || !this.canUploadFiles || this.isLocked()) {
      return;
    }

    this[stateKey] = true;
    this.incidentService
      .uploadIncidentArtifacts(this.currentIncident.id, draft)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this[stateKey] = false;
        })
      )
      .subscribe({
        next: () => {
          this.notifications.notify(successMessage);
        },
        error: () => {
          return;
        }
      });
  }

  private removeIncidentArtifact(
    artifactType: IncidentArtifactType,
    stateKey: 'deletingEvidence' | 'deletingReport',
    successMessage: string
  ): void {
    if (!this.currentIncident || !this.canUploadFiles || this.isLocked()) {
      return;
    }

    this[stateKey] = true;
    this.incidentService
      .removeIncidentArtifact(this.currentIncident.id, artifactType)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this[stateKey] = false;
        })
      )
      .subscribe({
        next: () => {
          this.notifications.notify(successMessage);
        },
        error: () => {
          return;
        }
      });
  }
}
