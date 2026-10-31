import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, defer, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BookingPaymentMethod, InsuranceAccounts, PaymentGate } from '../models/booking.model';
import { ReceptionEvents, unknownOutcome } from './reception-api';
import { SessionPaymentPrompt } from './session-payment-prompt';

@Injectable({providedIn: 'root'})
export class CourseFinanceService {
  private readonly http = inject(HttpClient);
  private readonly events = inject(ReceptionEvents);
  private readonly url = `${environment.apiUrl}/Finance`;
  readonly blockedAppointment = inject(SessionPaymentPrompt).appointment;
  private operationKey(scope: string, fallback: string) { try { const name = `ptcenter.finance.${scope}`; const key = sessionStorage.getItem(name) ?? fallback; sessionStorage.setItem(name, key); return key; } catch { return fallback; } }
  private finish(scope: string) { try { sessionStorage.removeItem(`ptcenter.finance.${scope}`); } catch {} }
  private operation<T>(scope: string, fallback: string, action: (key: string) => import('rxjs').Observable<T>) {
    return defer(() => action(this.operationKey(scope, fallback)).pipe(tap(() => this.finish(scope)), catchError(error => {
      if (!this.needsRetry(error)) this.finish(scope); return throwError(() => error);
    })));
  }
  gate(id: number) { return this.http.get<PaymentGate>(`${this.url}/appointments/${id}/payment-gate`); }
  collect(id: number, key: string, amount: number, method: BookingPaymentMethod) {
    return this.operation(`patient-${id}`, key, stable => this.http.post<PaymentGate>(`${this.url}/appointments/${id}/payments`, {idempotencyKey: stable, amount, method}))
      .pipe(tap(() => this.events.changed.next('billing')));
  }
  accounts() { return this.http.get<InsuranceAccounts>(`${this.url}/insurance/accounts`); }
  claim(invoiceId: number, key: string, submissionReference: string) {
    return this.operation(`claim-${invoiceId}`, key, stable => this.http.post(`${this.url}/insurance/claims`, {idempotencyKey: stable, invoiceId, submissionReference}));
  }
  settle(id: number, key: string, amount: number, method: BookingPaymentMethod, settlementReference: string) {
    return this.operation(`settle-${id}`, key, stable => this.http.post(`${this.url}/insurance/claims/${id}/settlements`, {idempotencyKey: stable, amount, method, settlementReference}))
      .pipe(tap(() => this.events.changed.next('billing')));
  }
  needsRetry(error: unknown) { return !(error instanceof HttpErrorResponse) || unknownOutcome(error) || ['Booking.ConcurrentChange', 'Booking.RetryKeyConflict'].includes(error.error?.title); }
}
