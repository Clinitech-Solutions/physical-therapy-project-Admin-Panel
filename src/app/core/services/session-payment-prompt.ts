import { Injectable, signal } from '@angular/core';

/** Keeps the global dialog trigger small; finance controls load only when needed. */
@Injectable({providedIn: 'root'})
export class SessionPaymentPrompt {
  readonly appointment = signal<number | null>(null);
}
