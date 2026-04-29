import { AsyncPipe, DatePipe, NgClass } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest, map } from 'rxjs';
import { Incident, SocUser } from '../../core/models/soc.models';
import { AuthService } from '../../core/services/auth.service';
import { IncidentService } from '../../core/services/incident.service';

@Component({
  selector: 'app-incident-queue',
  imports: [AsyncPipe, DatePipe, NgClass, RouterLink],
  templateUrl: './incident-queue.component.html'
})
export class IncidentQueueComponent implements OnInit {
  private readonly incidentService = inject(IncidentService);
  private readonly authService = inject(AuthService);
  readonly route = inject(ActivatedRoute);

  readonly user$ = this.authService.user$;
  readonly incidents$ = combineLatest([this.incidentService.incidents$, this.user$]).pipe(
    map(([incidents, user]) => {
      const mineOnly = this.route.snapshot.data['mineOnly'] === true;
      return mineOnly && user ? incidents.filter((incident) => incident.assignedTo?.id === user.id) : incidents;
    })
  );

  ngOnInit(): void {
    this.incidentService.loadIncidents().subscribe();
  }

  claim(incident: Incident): void {
    const user = this.authService.currentUser;
    if (!user || incident.assignedTo) {
      return;
    }

    this.incidentService.claimIncident(incident.id).subscribe();
  }

  assigneeInitials(assignee: SocUser | null | undefined): string {
    if (!assignee) {
      return '';
    }

    return assignee.name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  }
}
