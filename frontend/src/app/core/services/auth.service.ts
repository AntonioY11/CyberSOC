import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { BackendAuthSession } from '../models/backend.models';
import { AuthSession, LoginCredentials, SocUser, UserRole } from '../models/soc.models';
import { mapAuthSession } from './mappers';
import { mockUsers } from './mock-data';
import { CyberService } from './cyber.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storageKey = 'cybersoc.session';
  private readonly sessionSubject = new BehaviorSubject<AuthSession | null>(this.readSession());
  readonly session$ = this.sessionSubject.asObservable();
  readonly user$ = this.session$.pipe(map((session) => session?.user ?? null));

  constructor(private readonly cyber: CyberService) {}

  get token(): string | null {
    return this.sessionSubject.value?.accessToken ?? null;
  }

  get currentUser(): SocUser | null {
    return this.sessionSubject.value?.user ?? null;
  }

  login(credentials: LoginCredentials): Observable<AuthSession> {
    return this.cyber.post<BackendAuthSession>('/auth/login/', credentials).pipe(
      map(mapAuthSession),
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status !== 0 && error.status < 500) {
          return throwError(() => error);
        }

        return of(this.createDemoSession(credentials.email));
      }),
      tap((session) => this.setSession(session))
    );
  }

  logout(): void {
    localStorage.removeItem(this.storageKey);
    this.sessionSubject.next(null);
  }

  hasAnyRole(roles: UserRole[]): boolean {
    const user = this.currentUser;
    return !!user && roles.includes(user.role);
  }

  private setSession(session: AuthSession): void {
    localStorage.setItem(this.storageKey, JSON.stringify(session));
    this.sessionSubject.next(session);
  }

  private readSession(): AuthSession | null {
    const rawSession = localStorage.getItem(this.storageKey);
    if (!rawSession) {
      return null;
    }

    try {
      const parsedSession = JSON.parse(rawSession) as AuthSession;
      return parsedSession.accessToken && parsedSession.user ? parsedSession : null;
    } catch {
      localStorage.removeItem(this.storageKey);
      return null;
    }
  }

  private createDemoSession(email: string): AuthSession {
    const requestedRole: UserRole = email.toLowerCase().includes('admin') ? 'ADMIN' : 'ANALYST';
    const user = mockUsers.find((mockUser) => mockUser.role === requestedRole) ?? mockUsers[1];
    const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({ sub: user.id, email: user.email, role: user.role, name: user.name }));

    return {
      accessToken: `${header}.${payload}.demo`,
      user
    };
  }
}
