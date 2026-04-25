import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, of, tap } from 'rxjs';
import { BackendIncident } from '../models/backend.models';
import { Incident, IncidentDraft, SocUser } from '../models/soc.models';
import { CyberService } from './cyber.service';
import { mapIncident } from './mappers';
import { mockIncidents, mockSystems, mockThreatActors } from './mock-data';

@Injectable({ providedIn: 'root' })
export class IncidentService {
  private readonly incidentsSubject = new BehaviorSubject<Incident[]>([]);
  readonly incidents$ = this.incidentsSubject.asObservable();

  constructor(private readonly cyber: CyberService) {}

  loadIncidents(): Observable<Incident[]> {
    return this.cyber.get<BackendIncident[]>('/incidents/').pipe(
      map((incidents) => incidents.map(mapIncident)),
      catchError(() => of(this.mergeWithCurrent(mockIncidents))),
      tap((incidents) => this.incidentsSubject.next(incidents))
    );
  }

  incidentById(id: string): Observable<Incident | undefined> {
    return this.incidents$.pipe(map((incidents) => incidents.find((incident) => incident.id === id)));
  }

  claimIncident(incidentId: string, user: SocUser): Observable<Incident> {
    const optimisticIncident = this.updateLocalIncident(incidentId, (incident) => ({
      ...incident,
      status: incident.status === 'NEW' ? 'ASSIGNED' : incident.status,
      assignedTo: user,
      logs: [
        {
          id: `local-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actorName: user.name,
          action: 'Ticket claimed',
          notes: 'Analyst accepted ownership from the incident queue.'
        },
        ...incident.logs
      ]
    }));

    return this.cyber.patch<BackendIncident>(`/incidents/${incidentId}/claim/`, {}).pipe(
      map(mapIncident),
      tap((incident) => this.replaceIncident(incident)),
      catchError(() => of(optimisticIncident))
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
      catchError(() => of(this.createLocalIncident(draft))),
      tap((incident) => this.incidentsSubject.next([incident, ...this.incidentsSubject.value]))
    );
  }

  private replaceIncident(updatedIncident: Incident): void {
    this.incidentsSubject.next(
      this.incidentsSubject.value.map((incident) => (incident.id === updatedIncident.id ? updatedIncident : incident))
    );
  }

  private mergeWithCurrent(fallbackIncidents: Incident[]): Incident[] {
    const currentIncidents = this.incidentsSubject.value;
    const currentIds = new Set(currentIncidents.map((incident) => incident.id));
    return [...currentIncidents, ...fallbackIncidents.filter((incident) => !currentIds.has(incident.id))];
  }

  private updateLocalIncident(incidentId: string, updater: (incident: Incident) => Incident): Incident {
    const currentIncidents = this.incidentsSubject.value.length ? this.incidentsSubject.value : mockIncidents;
    const currentIncident = currentIncidents.find((incident) => incident.id === incidentId);
    const updatedIncident = currentIncident ? updater(currentIncident) : mockIncidents[0];
    this.incidentsSubject.next(
      currentIncidents.map((incident) => (incident.id === incidentId ? updatedIncident : incident))
    );
    return updatedIncident;
  }

  private createLocalIncident(draft: IncidentDraft): Incident {
    const system = mockSystems.find((asset) => asset.id === draft.systemId) ?? mockSystems[0];
    const actors = mockThreatActors.filter((actor) => draft.actorIds.includes(actor.id));

    return {
      id: `inc-${Date.now()}`,
      title: draft.title,
      description: draft.description,
      discoveryDate: new Date().toISOString().slice(0, 10),
      status: 'NEW',
      severity: draft.severity,
      isTruePositive: false,
      evidenceImage: null,
      forensicReport: null,
      system,
      assignedTo: null,
      actors,
      logs: [
        {
          id: `local-log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          actorName: 'SOC Console',
          action: 'Incident drafted',
          notes: 'Local optimistic case file created while the API is unavailable.'
        }
      ]
    };
  }
}
