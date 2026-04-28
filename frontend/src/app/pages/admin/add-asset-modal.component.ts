import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { SystemType } from '../../core/models/soc.models';
import { GovernanceService } from '../../core/services/governance.service';

const ipv4Pattern =
  /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

@Component({
  selector: 'app-add-asset-modal',
  imports: [ReactiveFormsModule],
  templateUrl: './add-asset-modal.component.html'
})
export class AddAssetModalComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly governanceService = inject(GovernanceService);

  @Input() open = false;
  @Output() closed = new EventEmitter<void>();
  @Output() assetAdded = new EventEmitter<void>();

  readonly types: SystemType[] = ['Network', 'Application', 'Database', 'Server', 'Endpoint', 'IoT'];
  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    type: ['Network' as SystemType, Validators.required],
    ipAddress: ['', [Validators.required, Validators.pattern(ipv4Pattern)]],
    criticality: [3, [Validators.required, Validators.min(1), Validators.max(5)]],
    description: ['', [Validators.required, Validators.minLength(8)]]
  });

  submitting = false;

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.governanceService
      .addAsset(this.form.getRawValue())
      .pipe(finalize(() => (this.submitting = false)))
      .subscribe(() => {
        this.assetAdded.emit();
        this.close();
      });
  }

  close(): void {
    this.form.reset({
      name: '',
      type: 'Network',
      ipAddress: '',
      criticality: 3,
      description: ''
    });
    this.closed.emit();
  }
}
