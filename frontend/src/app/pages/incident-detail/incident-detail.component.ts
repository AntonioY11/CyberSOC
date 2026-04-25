import { AsyncPipe, DatePipe, NgClass } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest, map } from 'rxjs';
import { IncidentLog } from '../../core/models/soc.models';
import { AuthService } from '../../core/services/auth.service';
import { IncidentService } from '../../core/services/incident.service';

@Component({
  selector: 'app-incident-detail',
  imports: [AsyncPipe, DatePipe, NgClass, RouterLink],
  templateUrl: './incident-detail.component.html'
})
export class IncidentDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly incidentService = inject(IncidentService);
  private readonly authService = inject(AuthService);

  readonly user$ = this.authService.user$;
  readonly incident$ = combineLatest([this.route.paramMap, this.incidentService.incidents$]).pipe(
    map(([params, incidents]) => incidents.find((incident) => incident.id === params.get('id')))
  );
  ngOnInit(): void {
    this.incidentService.loadIncidents().subscribe();
  }

  sortedLogs(logs: IncidentLog[]): IncidentLog[] {
    return [...logs].sort((first, second) => Date.parse(second.timestamp) - Date.parse(first.timestamp));
  }
}
