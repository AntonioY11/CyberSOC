import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, of, tap } from 'rxjs';
import { BackendThreatActor } from '../models/backend.models';
import { ThreatActor, ThreatActorDraft } from '../models/soc.models';
import { CyberService } from './cyber.service';
import { mapThreatActor } from './mappers';

@Injectable({ providedIn: 'root' })
export class ThreatActorService {
  private readonly actorsSubject = new BehaviorSubject<ThreatActor[]>([]);
  private readonly adminActorsSubject = new BehaviorSubject<ThreatActor[]>([]);
  readonly actors$ = this.actorsSubject.asObservable();
  readonly adminActors$ = this.adminActorsSubject.asObservable();

  constructor(private readonly cyber: CyberService) {}

  loadActors(): Observable<ThreatActor[]> {
    return this.cyber.get<BackendThreatActor[]>('/threat-actors/').pipe(
      map((actors) => actors.map(mapThreatActor)),
      catchError(() => of([])),
      tap((actors) => this.actorsSubject.next(actors))
    );
  }

  loadAdminActors(): Observable<ThreatActor[]> {
    return this.cyber.get<BackendThreatActor[]>('/admin/threat-actors/').pipe(
      map((actors) => actors.map(mapThreatActor)),
      catchError(() => of([])),
      tap((actors) => this.adminActorsSubject.next(actors))
    );
  }

  createAdminActor(draft: ThreatActorDraft): Observable<ThreatActor> {
    return this.cyber.post<BackendThreatActor>('/admin/threat-actors/', this.toActorPayload(draft)).pipe(
      map(mapThreatActor),
      tap((actor) => this.adminActorsSubject.next([actor, ...this.adminActorsSubject.value]))
    );
  }

  updateAdminActor(actorId: string, draft: ThreatActorDraft): Observable<ThreatActor> {
    return this.cyber.patch<BackendThreatActor>(`/admin/threat-actors/${actorId}/`, this.toActorPayload(draft)).pipe(
      map(mapThreatActor),
      tap((updatedActor) => {
        this.adminActorsSubject.next(
          this.adminActorsSubject.value.map((actor) => (actor.id === updatedActor.id ? updatedActor : actor))
        );
      })
    );
  }

  private toActorPayload(draft: ThreatActorDraft): Record<string, string> {
    return {
      name: draft.name,
      status: draft.status,
      origin_country: draft.originCountry,
      tactics: draft.tactics,
      threat_level: draft.threatLevel
    };
  }
}
