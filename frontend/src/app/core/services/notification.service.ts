import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly messagesSubject = new BehaviorSubject<string[]>([]);
  readonly messages$ = this.messagesSubject.asObservable();

  notify(message: string): void {
    this.messagesSubject.next([message, ...this.messagesSubject.value].slice(0, 4));
  }

  dismiss(index: number): void {
    this.messagesSubject.next(this.messagesSubject.value.filter((_, currentIndex) => currentIndex !== index));
  }
}
