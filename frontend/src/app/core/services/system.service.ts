import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, of, tap } from 'rxjs';
import { BackendSystemAsset } from '../models/backend.models';
import { SystemAsset } from '../models/soc.models';
import { CyberService } from './cyber.service';
import { mapSystem } from './mappers';
import { mockSystems } from './mock-data';

@Injectable({ providedIn: 'root' })
export class SystemService {
  private readonly systemsSubject = new BehaviorSubject<SystemAsset[]>([]);
  readonly systems$ = this.systemsSubject.asObservable();

  constructor(private readonly cyber: CyberService) {}

  loadSystems(): Observable<SystemAsset[]> {
    return this.cyber.get<BackendSystemAsset[]>('/systems/').pipe(
      map((systems) => systems.map(mapSystem)),
      catchError(() => of(mockSystems)),
      tap((systems) => this.systemsSubject.next(systems))
    );
  }
}
