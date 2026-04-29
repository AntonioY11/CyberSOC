import { AsyncPipe, NgClass } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { IncidentDraft, IncidentSeverity } from '../../core/models/soc.models';
import { IncidentService } from '../../core/services/incident.service';
import { NotificationService } from '../../core/services/notification.service';
import { ThreatActorComboboxComponent } from '../../core/components/threat-actor-combobox/threat-actor-combobox.component';
import { SystemService } from '../../core/services/system.service';

const maxFileSizeBytes = 8 * 1024 * 1024;
const threatActorNamePattern = /^[A-Za-z0-9][A-Za-z0-9\s.'()/_&,-]*$/;

@Component({
  selector: 'app-incident-form',
  imports: [AsyncPipe, NgClass, ReactiveFormsModule, ThreatActorComboboxComponent],
  templateUrl: './incident-form.component.html'
})
export class IncidentFormComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly incidentService = inject(IncidentService);
  private readonly systemService = inject(SystemService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

  readonly severities: IncidentSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  readonly systems$ = this.systemService.systems$;
  readonly form = this.formBuilder.nonNullable.group(
    {
      title: ['', [Validators.required, Validators.minLength(6)]],
      description: ['', [Validators.required, Validators.minLength(20)]],
      systemId: ['', Validators.required],
      severity: ['HIGH' as IncidentSeverity, Validators.required],
      actorIds: this.formBuilder.nonNullable.control<string[]>([]),
      threatActorName: this.formBuilder.nonNullable.control('', [this.threatActorNameValidator]),
      evidenceImage: this.formBuilder.control<File | null>(null, [this.fileSizeValidator]),
      forensicReport: this.formBuilder.control<File | null>(null, [Validators.required, this.fileSizeValidator, this.pdfValidator])
    },
    { validators: [this.actorSelectionValidator] }
  );

  imageProgress = 0;
  reportProgress = 0;
  submitting = false;

  ngOnInit(): void {
    this.systemService.loadSystems().subscribe();
  }

  onFileSelected(event: Event, controlName: 'evidenceImage' | 'forensicReport'): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0) ?? null;
    const control = this.form.controls[controlName];

    control.setValue(file);
    control.markAsTouched();
    control.updateValueAndValidity();

    if (controlName === 'evidenceImage') {
      this.imageProgress = file && control.valid ? 100 : 0;
    } else {
      this.reportProgress = file && control.valid ? 100 : 0;
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.incidentService
      .createIncident(this.form.getRawValue() as IncidentDraft)
      .pipe(finalize(() => (this.submitting = false)))
      .subscribe((incident) => {
        this.notifications.notify('Incident created successfully. Opening the case file.');
        void this.router.navigate(['/incidents', incident.id]);
      });
  }

  private fileSizeValidator(control: AbstractControl<File | null>): ValidationErrors | null {
    const file = control.value;
    return file && file.size > maxFileSizeBytes ? { fileSize: true } : null;
  }

  private pdfValidator(control: AbstractControl<File | null>): ValidationErrors | null {
    const file = control.value;
    return file && file.type !== 'application/pdf' ? { pdf: true } : null;
  }

  private threatActorNameValidator(control: AbstractControl<string>): ValidationErrors | null {
    const value = control.value.trim();
    if (!value) {
      return null;
    }

    return threatActorNamePattern.test(value) ? null : { threatActorName: true };
  }

  private actorSelectionValidator(control: AbstractControl): ValidationErrors | null {
    const actorIds = (control.get('actorIds')?.value as string[] | null) ?? [];
    const threatActorName = String(control.get('threatActorName')?.value ?? '').trim();

    return actorIds.length > 0 || threatActorName ? null : { actorSelection: true };
  }
}
