import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, of, tap } from 'rxjs';
import { BackendUser } from '../models/backend.models';
import { SocUser } from '../models/soc.models';
import { CyberService } from './cyber.service';
import { mapUser } from './mappers';
import { mockUsers } from './mock-data';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly usersSubject = new BehaviorSubject<SocUser[]>([]);
  readonly users$ = this.usersSubject.asObservable();

  constructor(private readonly cyber: CyberService) {}

  loadUsers(): Observable<SocUser[]> {
    return this.cyber.get<BackendUser[]>('/users/').pipe(
      map((users) => users.map(mapUser)),
      catchError(() => of(mockUsers)),
      tap((users) => this.usersSubject.next(users))
    );
  }
}
