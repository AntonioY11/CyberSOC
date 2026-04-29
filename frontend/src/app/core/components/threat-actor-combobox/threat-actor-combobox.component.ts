import { AsyncPipe } from '@angular/common';
import { Component, Input, OnInit, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ThreatActor } from '../../models/soc.models';
import { ThreatActorService } from '../../services/threat-actor.service';

const threatActorPattern = /^[A-Za-z0-9][A-Za-z0-9\s.'()/_&,-]*$/;

@Component({
  selector: 'app-threat-actor-combobox',
  standalone: true,
  imports: [AsyncPipe, ReactiveFormsModule],
  templateUrl: './threat-actor-combobox.component.html',
  styleUrl: './threat-actor-combobox.component.css'
})
export class ThreatActorComboboxComponent implements OnInit {
  private readonly threatActorService = inject(ThreatActorService);
  private actorsCache: ThreatActor[] = [];

  @Input({ required: true }) actorIdsControl!: FormControl<string[]>;
  @Input({ required: true }) newActorNameControl!: FormControl<string>;
  @Input() label = 'Threat actor';
  @Input() placeholder = 'Search threat actors';
  @Input() hint = 'Hold Ctrl or Cmd to select multiple actors. Use the search box to filter the list.';

  readonly actors$ = this.threatActorService.actors$;
  isOpen = false;
  searchTerm = '';
  workingSelection: string[] = [];

  ngOnInit(): void {
    this.threatActorService.loadActors().subscribe((actors) => {
      this.actorsCache = actors;
    });
  }

  open(): void {
    this.searchTerm = this.newActorNameControl.value.trim();
    this.workingSelection = [...this.actorIdsControl.value];
    this.isOpen = true;
  }

  close(): void {
    this.isOpen = false;
  }

  onSearchInput(event: Event): void {
    this.searchTerm = (event.target as HTMLInputElement).value;
  }

  syncSelection(selectElement: HTMLSelectElement): void {
    this.workingSelection = Array.from(selectElement.selectedOptions).map((option) => option.value);
  }

  applySelection(): void {
    this.actorIdsControl.setValue([...this.workingSelection]);
    this.actorIdsControl.markAsTouched();
    this.actorIdsControl.updateValueAndValidity();
    this.isOpen = false;
  }

  addTypedActor(value: string): void {
    const normalized = value.trim();
    if (!normalized) {
      return;
    }

    this.newActorNameControl.setValue(normalized);
    this.newActorNameControl.markAsTouched();
    this.newActorNameControl.updateValueAndValidity();
    this.isOpen = false;
  }

  filteredActors(actors: readonly ThreatActor[]): ThreatActor[] {
    const query = this.normalizedQuery;
    const visibleActors = query ? actors.filter((actor) => actor.name.toLowerCase().includes(query)) : [...actors];
    return visibleActors;
  }

  canAddActor(actors: readonly ThreatActor[]): boolean {
    const value = this.searchTerm.trim();
    if (!value || !threatActorPattern.test(value)) {
      return false;
    }

    return !actors.some((actor) => actor.name.toLowerCase() === value.toLowerCase());
  }

  get selectedCount(): number {
    return this.actorIdsControl.value.length;
  }

  get normalizedQuery(): string {
    return this.searchTerm.trim().toLowerCase();
  }

  get selectedActorNames(): string[] {
    const selectedIds = new Set(this.actorIdsControl.value);
    return this.actorsCache.filter((actor) => selectedIds.has(actor.id)).map((actor) => actor.name);
  }

  get pendingNewActorName(): string {
    return this.newActorNameControl.value.trim();
  }

}
