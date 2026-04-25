import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, of, tap } from 'rxjs';
import { BackendIncidentLog } from '../models/backend.models';
import { AuditLogEntry } from '../models/soc.models';
import { CyberService } from './cyber.service';
import { mapAuditLog } from './mappers';

@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly auditLogsSubject = new BehaviorSubject<AuditLogEntry[]>([]);
  readonly auditLogs$ = this.auditLogsSubject.asObservable();

  constructor(private readonly cyber: CyberService) {}

  loadAuditLogs(): Observable<AuditLogEntry[]> {
    return this.cyber.get<BackendIncidentLog[]>('/incident-logs/').pipe(
      map((logs) => logs.map(mapAuditLog)),
      catchError(() => of([])),
      tap((logs) => this.auditLogsSubject.next(logs))
    );
  }
}
