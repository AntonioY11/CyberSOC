import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CyberService {
  private readonly apiBase = 'http://127.0.0.1:8001/api';

  constructor(private readonly http: HttpClient) {}

  get<T>(endpoint: string): Observable<T> {
    return this.http.get<T>(this.url(endpoint));
  }

  post<T>(endpoint: string, body: unknown): Observable<T> {
    return this.http.post<T>(this.url(endpoint), body);
  }

  patch<T>(endpoint: string, body: unknown): Observable<T> {
    return this.http.patch<T>(this.url(endpoint), body);
  }

  delete<T>(endpoint: string): Observable<T> {
    return this.http.delete<T>(this.url(endpoint));
  }

  private url(endpoint: string): string {
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${this.apiBase}${normalizedEndpoint}`;
  }
}
