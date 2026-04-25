import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, of, tap } from 'rxjs';
import { AuditLogEntry } from '../models/soc.models';
import { CyberService } from './cyber.service';
import { mockAuditLogs } from './mock-data';

@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly auditLogsSubject = new BehaviorSubject<AuditLogEntry[]>([]);
  readonly auditLogs$ = this.auditLogsSubject.asObservable();

  constructor(private readonly cyber: CyberService) {}

  loadAuditLogs(): Observable<AuditLogEntry[]> {
    return this.cyber.get<AuditLogEntry[]>('/audit-logs/').pipe(
      catchError(() => of(mockAuditLogs)),
      tap((logs) => this.auditLogsSubject.next(logs))
    );
  }
}
