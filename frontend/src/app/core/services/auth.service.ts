import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map, tap } from 'rxjs';
import { BackendAuthSession } from '../models/backend.models';
import { AuthSession, LoginCredentials, SocUser, UserRole } from '../models/soc.models';
import { mapAuthSession } from './mappers';
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
      tap((session) => this.setSession(session))
    );
  }

  refreshAccessToken(): Observable<string> {
    const refreshToken = this.sessionSubject.value?.refreshToken;

    if (!refreshToken) {
      throw new Error('Missing refresh token.');
    }

    return this.cyber.post<{ access: string }>('/token/refresh/', { refresh: refreshToken }).pipe(
      map((response) => response.access),
      tap((accessToken) => this.updateAccessToken(accessToken))
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

  private updateAccessToken(accessToken: string): void {
    const session = this.sessionSubject.value;

    if (!session) {
      return;
    }

    const updatedSession = {
      ...session,
      accessToken
    };

    localStorage.setItem(this.storageKey, JSON.stringify(updatedSession));
    this.sessionSubject.next(updatedSession);
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
}
