import { AsyncPipe, NgClass } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { combineLatest } from 'rxjs';
import { IncidentDraft, IncidentSeverity } from '../../core/models/soc.models';
import { IncidentService } from '../../core/services/incident.service';
import { SystemService } from '../../core/services/system.service';
import { ThreatActorService } from '../../core/services/threat-actor.service';

const maxFileSizeBytes = 8 * 1024 * 1024;

@Component({
  selector: 'app-incident-form',
  imports: [AsyncPipe, NgClass, ReactiveFormsModule],
  templateUrl: './incident-form.component.html'
})
export class IncidentFormComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly incidentService = inject(IncidentService);
  private readonly systemService = inject(SystemService);
  private readonly threatActorService = inject(ThreatActorService);
  private readonly router = inject(Router);

  readonly severities: IncidentSeverity[] = ['Low', 'Medium', 'High', 'Critical'];
  readonly systems$ = this.systemService.systems$;
  readonly actors$ = this.threatActorService.actors$;
  readonly form = this.formBuilder.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(6)]],
    description: ['', [Validators.required, Validators.minLength(20)]],
    systemId: ['', Validators.required],
    severity: ['High' as IncidentSeverity, Validators.required],
    actorIds: this.formBuilder.nonNullable.control<string[]>([]),
    evidenceImage: this.formBuilder.control<File | null>(null, [this.fileSizeValidator]),
    forensicReport: this.formBuilder.control<File | null>(null, [Validators.required, this.fileSizeValidator, this.pdfValidator])
  });

  imageProgress = 0;
  reportProgress = 0;
  submitting = false;

  ngOnInit(): void {
    combineLatest([this.systemService.loadSystems(), this.threatActorService.loadActors()]).subscribe();
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
    this.incidentService.createIncident(this.form.getRawValue() as IncidentDraft).subscribe({
      next: (incident) => {
        void this.router.navigate(['/incidents', incident.id]);
      },
      complete: () => {
        this.submitting = false;
      }
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
}
