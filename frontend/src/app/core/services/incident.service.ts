import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, of, tap } from 'rxjs';
import { BackendIncident } from '../models/backend.models';
import { Incident, IncidentDraft } from '../models/soc.models';
import { CyberService } from './cyber.service';
import { mapIncident } from './mappers';

@Injectable({ providedIn: 'root' })
export class IncidentService {
  private readonly incidentsSubject = new BehaviorSubject<Incident[]>([]);
  readonly incidents$ = this.incidentsSubject.asObservable();

  constructor(private readonly cyber: CyberService) {}

  loadIncidents(): Observable<Incident[]> {
    return this.cyber.get<BackendIncident[]>('/incidents/').pipe(
      map((incidents) => incidents.map(mapIncident)),
      catchError(() => of([])),
      tap((incidents) => this.incidentsSubject.next(incidents))
    );
  }

  incidentById(id: string): Observable<Incident | undefined> {
    return this.incidents$.pipe(map((incidents) => incidents.find((incident) => incident.id === id)));
  }

  claimIncident(incidentId: string): Observable<Incident> {
    return this.cyber.patch<BackendIncident>(`/incidents/${incidentId}/claim/`, {}).pipe(
      map(mapIncident),
      tap((incident) => this.replaceIncident(incident))
    );
  }

  createIncident(draft: IncidentDraft): Observable<Incident> {
    const formData = new FormData();
    formData.append('title', draft.title);
    formData.append('description', draft.description);
    formData.append('system', draft.systemId);
    formData.append('severity', draft.severity);
    formData.append('status', 'NEW');
    for (const actorId of draft.actorIds) {
      formData.append('actors', actorId);
    }

    if (draft.evidenceImage) {
      formData.append('evidence_image', draft.evidenceImage);
    }

    if (draft.forensicReport) {
      formData.append('forensic_report', draft.forensicReport);
    }

    return this.cyber.post<BackendIncident>('/incidents/', formData).pipe(
      map(mapIncident),
      tap((incident) => this.incidentsSubject.next([incident, ...this.incidentsSubject.value]))
    );
  }

  private replaceIncident(updatedIncident: Incident): void {
    this.incidentsSubject.next(
      this.incidentsSubject.value.map((incident) => (incident.id === updatedIncident.id ? updatedIncident : incident))
    );
  }
}
