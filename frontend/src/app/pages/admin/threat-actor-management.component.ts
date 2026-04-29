import { AsyncPipe, DatePipe, NgClass } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ThreatActor, ThreatActorDraft, ThreatActorStatus, ThreatLevel } from '../../core/models/soc.models';
import { NotificationService } from '../../core/services/notification.service';
import { ThreatActorService } from '../../core/services/threat-actor.service';

const actorNamePattern = /^[A-Za-z0-9][A-Za-z0-9\s.'()/_&,-]*$/;

@Component({
  selector: 'app-threat-actor-management',
  standalone: true,
  imports: [AsyncPipe, DatePipe, NgClass, ReactiveFormsModule],
  templateUrl: './threat-actor-management.component.html',
  styleUrl: './threat-actor-management.component.css'
})
export class ThreatActorManagementComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly threatActorService = inject(ThreatActorService);
  private readonly notifications = inject(NotificationService);

  readonly actors$ = this.threatActorService.adminActors$;
  readonly statuses: ThreatActorStatus[] = ['UNVERIFIED', 'VERIFIED'];
  readonly threatLevels: ThreatLevel[] = ['Low', 'Medium', 'High', 'Critical'];

  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3), Validators.pattern(actorNamePattern)]],
    originCountry: ['Unknown'],
    tactics: [''],
    threatLevel: ['Medium' as ThreatLevel, Validators.required],
    status: ['UNVERIFIED' as ThreatActorStatus, Validators.required]
  });

  isModalOpen = false;
  isSaving = false;
  editingActorId: string | null = null;
  searchTerm = '';

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.threatActorService.loadAdminActors().subscribe();
    this.threatActorService.loadActors().subscribe();
  }

  onSearchInput(event: Event): void {
    this.searchTerm = (event.target as HTMLInputElement).value;
  }

  openCreate(): void {
    this.editingActorId = null;
    this.form.reset({
      name: '',
      originCountry: 'Unknown',
      tactics: '',
      threatLevel: 'Medium',
      status: 'UNVERIFIED'
    });
    this.isModalOpen = true;
  }

  openEdit(actor: ThreatActor): void {
    this.editingActorId = actor.id;
    this.form.reset({
      name: actor.name,
      originCountry: actor.originCountry || 'Unknown',
      tactics: actor.tactics || '',
      threatLevel: actor.threatLevel,
      status: actor.status
    });
    this.form.markAsUntouched();
    this.isModalOpen = true;
  }

  close(): void {
    this.isModalOpen = false;
    this.editingActorId = null;
    this.form.reset({
      name: '',
      originCountry: 'Unknown',
      tactics: '',
      threatLevel: 'Medium',
      status: 'UNVERIFIED'
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const draft = this.form.getRawValue() as ThreatActorDraft;
    this.isSaving = true;
    const request$ = this.editingActorId
      ? this.threatActorService.updateAdminActor(this.editingActorId, draft)
      : this.threatActorService.createAdminActor(draft);

    request$
      .pipe(finalize(() => (this.isSaving = false)))
      .subscribe((actor) => {
        this.notifications.notify(this.editingActorId ? `Threat Actor updated: ${actor.name}.` : `Threat Actor created: ${actor.name}.`);
        this.refresh();
        this.close();
      });
  }

  filteredActors(actors: readonly ThreatActor[]): ThreatActor[] {
    const query = this.searchTerm.trim().toLowerCase();
    return query ? actors.filter((actor) => actor.name.toLowerCase().includes(query)) : [...actors];
  }

  severityClass(level: ThreatLevel): string {
    return level.toLowerCase();
  }

  validationMessage(controlName: 'name' | 'status' | 'threatLevel'): string | null {
    const control = this.form.controls[controlName];
    if (!control.touched && !control.dirty) {
      return null;
    }

    if (control.hasError('required')) {
      return `${controlName === 'name' ? 'Name' : controlName} is required.`;
    }

    if (controlName === 'name' && control.hasError('pattern')) {
      return 'Use letters, numbers, spaces, and basic punctuation only.';
    }

    return null;
  }

  fieldError(controlName: 'name'): ValidationErrors | null {
    return this.form.controls[controlName].errors;
  }
}
