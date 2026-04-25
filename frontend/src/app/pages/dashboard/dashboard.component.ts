import { AsyncPipe, DatePipe, NgClass, PercentPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { BehaviorSubject, combineLatest, map } from 'rxjs';
import { IncidentSeverity, IncidentStatus } from '../../core/models/soc.models';
import { IncidentService } from '../../core/services/incident.service';

@Component({
  selector: 'app-dashboard',
  imports: [AsyncPipe, DatePipe, NgClass, PercentPipe],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent implements OnInit {
  private readonly incidentService = inject(IncidentService);

  readonly statuses: Array<IncidentStatus | 'ALL'> = ['ALL', 'NEW', 'ASSIGNED', 'INVESTIGATING', 'MITIGATED', 'RESOLVED'];
  readonly severities: Array<IncidentSeverity | 'ALL'> = ['ALL', 'Low', 'Medium', 'High', 'Critical'];
  private readonly statusFilterSubject = new BehaviorSubject<IncidentStatus | 'ALL'>('ALL');
  private readonly severityFilterSubject = new BehaviorSubject<IncidentSeverity | 'ALL'>('ALL');

  readonly statusFilter$ = this.statusFilterSubject.asObservable();
  readonly severityFilter$ = this.severityFilterSubject.asObservable();
  readonly vm$ = combineLatest([
    this.incidentService.incidents$,
    this.statusFilter$,
    this.severityFilter$
  ]).pipe(
    map(([incidents, statusFilter, severityFilter]) => {
      const filteredIncidents = incidents.filter((incident) => {
        const statusMatches = statusFilter === 'ALL' || incident.status === statusFilter;
        const severityMatches = severityFilter === 'ALL' || incident.severity === severityFilter;
        return statusMatches && severityMatches;
      });
      const activeIncidents = incidents.filter((incident) => incident.status !== 'RESOLVED');
      const truePositiveCount = incidents.filter((incident) => incident.isTruePositive).length;

      return {
        filteredIncidents,
        totalActive: activeIncidents.length,
        highSeverity: incidents.filter((incident) => ['High', 'Critical'].includes(incident.severity)).length,
        unassigned: incidents.filter((incident) => !incident.assignedTo).length,
        truePositiveRate: incidents.length ? truePositiveCount / incidents.length : 0
      };
    })
  );
  ngOnInit(): void {
    this.incidentService.loadIncidents().subscribe();
  }

  setStatusFilter(status: IncidentStatus | 'ALL'): void {
    this.statusFilterSubject.next(status);
  }

  setSeverityFilter(severity: IncidentSeverity | 'ALL'): void {
    this.severityFilterSubject.next(severity);
  }
}
