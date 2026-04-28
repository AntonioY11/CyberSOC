import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { UserRole } from '../../core/models/soc.models';
import { GovernanceService } from '../../core/services/governance.service';

@Component({
  selector: 'app-invite-user-modal',
  imports: [ReactiveFormsModule],
  templateUrl: './invite-user-modal.component.html'
})
export class InviteUserModalComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly governanceService = inject(GovernanceService);

  @Input() open = false;
  @Output() closed = new EventEmitter<void>();
  @Output() userInvited = new EventEmitter<void>();

  readonly roles: UserRole[] = ['ANALYST', 'ADMIN'];
  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    role: ['ANALYST' as UserRole, Validators.required]
  });

  submitting = false;
  temporaryPassword: string | null = null;
  copied = false;

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.governanceService
      .inviteUser(this.form.getRawValue())
      .pipe(finalize(() => (this.submitting = false)))
      .subscribe((result) => {
        this.temporaryPassword = result.temporaryPassword;
        this.copied = false;
        this.userInvited.emit();
      });
  }

  copyTemporaryPassword(): void {
    if (!this.temporaryPassword) {
      return;
    }

    void navigator.clipboard.writeText(this.temporaryPassword).then(() => {
      this.copied = true;
      window.setTimeout(() => {
        this.copied = false;
      }, 1800);
    });
  }

  close(): void {
    this.form.reset({ name: '', email: '', role: 'ANALYST' });
    this.temporaryPassword = null;
    this.copied = false;
    this.closed.emit();
  }
}
