import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, of, tap } from 'rxjs';
import { BackendThreatActor } from '../models/backend.models';
import { ThreatActor } from '../models/soc.models';
import { CyberService } from './cyber.service';
import { mapThreatActor } from './mappers';

@Injectable({ providedIn: 'root' })
export class ThreatActorService {
  private readonly actorsSubject = new BehaviorSubject<ThreatActor[]>([]);
  readonly actors$ = this.actorsSubject.asObservable();

  constructor(private readonly cyber: CyberService) {}

  loadActors(): Observable<ThreatActor[]> {
    return this.cyber.get<BackendThreatActor[]>('/threat-actors/').pipe(
      map((actors) => actors.map(mapThreatActor)),
      catchError(() => of([])),
      tap((actors) => this.actorsSubject.next(actors))
    );
  }
}
