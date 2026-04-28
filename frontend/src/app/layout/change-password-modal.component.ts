import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { GovernanceService } from '../core/services/governance.service';

function matchingPasswords(control: AbstractControl): ValidationErrors | null {
  const newPassword = control.get('newPassword')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return newPassword && confirmPassword && newPassword !== confirmPassword ? { passwordMismatch: true } : null;
}

@Component({
  selector: 'app-change-password-modal',
  imports: [ReactiveFormsModule],
  templateUrl: './change-password-modal.component.html'
})
export class ChangePasswordModalComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly governanceService = inject(GovernanceService);

  @Input() open = false;
  @Output() closed = new EventEmitter<void>();
  @Output() passwordChanged = new EventEmitter<void>();

  readonly form = this.formBuilder.nonNullable.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required]
    },
    { validators: matchingPasswords }
  );

  submitting = false;

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { currentPassword, newPassword } = this.form.getRawValue();
    this.submitting = true;
    this.governanceService
      .changePassword({ currentPassword, newPassword })
      .pipe(finalize(() => (this.submitting = false)))
      .subscribe(() => {
        this.passwordChanged.emit();
        this.close();
      });
  }

  close(): void {
    this.form.reset({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    this.closed.emit();
  }
}
