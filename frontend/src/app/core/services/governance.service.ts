import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BackendInviteUserResponse, BackendSystemAsset } from '../models/backend.models';
import {
  AssetDraft,
  ChangePasswordDraft,
  InviteUserDraft,
  InviteUserResult,
  SystemAsset
} from '../models/soc.models';
import { CyberService } from './cyber.service';
import { mapInviteUserResult, mapSystem } from './mappers';

@Injectable({ providedIn: 'root' })
export class GovernanceService {
  private readonly cyber = inject(CyberService);

  inviteUser(draft: InviteUserDraft): Observable<InviteUserResult> {
    return this.cyber
      .post<BackendInviteUserResponse>('/admin/invite-user/', draft)
      .pipe(map(mapInviteUserResult));
  }

  addAsset(draft: AssetDraft): Observable<SystemAsset> {
    return this.cyber
      .post<BackendSystemAsset>('/admin/add-asset/', {
        name: draft.name,
        type: draft.type,
        ip_address: draft.ipAddress,
        criticality: draft.criticality,
        description: draft.description
      })
      .pipe(map(mapSystem));
  }

  changePassword(draft: ChangePasswordDraft): Observable<{ detail: string }> {
    return this.cyber.patch<{ detail: string }>('/auth/change-password/', {
      current_password: draft.currentPassword,
      new_password: draft.newPassword
    });
  }
}
