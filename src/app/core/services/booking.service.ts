import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, defer, map, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BookingAccount, BookingClinician, BookingContext, BookingPlan, BookingPreview, BookingReceipt, BookingRequest, BookingPaymentMethod } from '../models/booking.model';
import { numericId, ReceptionEvents, unknownOutcome } from './reception-api';
import { pagedRecords } from './reception-pagination';
import { Patient } from '../models/patient.model';

const storageKey = 'ptcenter.pending-booking-key';
function pendingKey(): string | null {
  try { return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(storageKey); } catch { return null; }
}
@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly http = inject(HttpClient);
  private readonly events = inject(ReceptionEvents);
  private readonly url = `${environment.apiUrl}/Bookings`;
  readonly uncertainKey = signal<string | null>(pendingKey());
  readonly pendingCollection = signal<{ accountKey: string; key: string } | null>(this.readCollection());
  private readCollection(): { accountKey: string; key: string } | null {
    try { return typeof sessionStorage === 'undefined' ? null : JSON.parse(sessionStorage.getItem('ptcenter.pending-collection-key') ?? 'null'); } catch { return null; }
  }
  private setCollection(value: { accountKey: string; key: string } | null) {
    this.pendingCollection.set(value);
    try { if (typeof sessionStorage !== 'undefined') value ? sessionStorage.setItem('ptcenter.pending-collection-key', JSON.stringify(value)) : sessionStorage.removeItem('ptcenter.pending-collection-key'); } catch { /* The in-memory operation key is retained. */ }
  }
  private setKey(key: string | null) {
    this.uncertainKey.set(key);
    // Only an opaque operation key survives reload; patient details and prices are never stored here.
    try { if (typeof sessionStorage !== 'undefined') key ? sessionStorage.setItem(storageKey, key) : sessionStorage.removeItem(storageKey); } catch { /* Reconciliation remains available in this tab. */ }
  }
  context(id: number) { return this.http.get<BookingContext>(`${this.url}/patients/${numericId(id)}`); }
  directory() {
    return pagedRecords<Patient>(this.http, `${this.url}/patients`, value => {
      const row = value as { id: number; fullName: string; phoneNumber: string; gender: 'Male' | 'Female' };
      if (typeof row?.fullName !== 'string' || typeof row.phoneNumber !== 'string' || !['Male', 'Female'].includes(row.gender)) throw new Error('Invalid patient directory response.');
      return { id: String(numericId(row.id)), nameEn: row.fullName, nameAr: row.fullName, phone: row.phoneNumber,
        gender: row.gender, avatar: row.fullName.split(/\s+/).map(n => n[0]).join('').slice(0, 2), paymentType: null, lastVisit: '',
        documentsKnown: false, documents: { medicalConsent: false, liabilityWaiver: false, idCard: false } };
    });
  }
  workload() { return this.http.get<BookingClinician[]>(`${this.url}/clinicians/workload`); }
  accounts() { return this.http.get<BookingAccount[]>(`${this.url}/accounts`); }
  collectAccount(accountKey: string, amount: number, method: BookingPaymentMethod) {
    return defer(() => {
      const pending = this.pendingCollection();
      if (pending && pending.accountKey !== accountKey) throw new Error('Reconcile the pending collection first.');
      const key = pending?.key ?? crypto.randomUUID(); this.setCollection({ accountKey, key });
      return this.http.post<BookingReceipt>(`${this.url}/accounts/${encodeURIComponent(accountKey)}/payments`, { idempotencyKey: key, amount, method }).pipe(
        map(value => this.receipt(value)), tap(() => { this.setCollection(null); this.events.changed.next('billing'); }),
        catchError(error => {
          if (!pending && error instanceof HttpErrorResponse && !unknownOutcome(error) && !['Booking.ConcurrentChange', 'Booking.RetryKeyConflict'].includes(error.error?.title)) this.setCollection(null);
          return throwError(() => error);
        })
      );
    });
  }
  reconcileCollection() {
    const pending = this.pendingCollection(); if (!pending) return throwError(() => new Error('No pending collection.'));
    return this.http.get<BookingReceipt>(`${this.url}/accounts/${encodeURIComponent(pending.accountKey)}/payments/${encodeURIComponent(pending.key)}`).pipe(
      map(value => this.receipt(value)), tap(() => this.setCollection(null))
    );
  }
  clinicians(id: number, planId: number | null, treatment = false) {
    return this.http.get<BookingClinician[]>(`${this.url}/patients/${numericId(id)}/clinicians`, {
      params: { ...(planId == null ? {} : { planId }), ...(treatment ? { treatment: true } : {}) }
    });
  }
  preview(request: BookingRequest) { return this.http.post<BookingPreview>(`${this.url}/preview`, request); }
  private receipt(value: BookingReceipt): BookingReceipt {
    if (value?.outcome !== 'Committed' || !value.idempotencyKey || !Array.isArray(value.appointments) || !value.appointments.length ||
      !value.appointments.every(a => Number.isSafeInteger(a.id) && a.id > 0 && new Date(a.endTime).getTime() - new Date(a.startTime).getTime() === 3600000) ||
      !Array.isArray(value.invoiceIds) || value.invoiceIds.length !== value.appointments.length || !value.invoiceIds.every(id => Number.isSafeInteger(id) && id > 0) ||
      ![value.totalAmount, value.patientAmount, value.insuranceAmount, value.paidAmount, value.remainingAmount].every(amount => Number.isFinite(amount) && amount >= 0) ||
      Math.abs(value.totalAmount - value.patientAmount - value.insuranceAmount) > 0.001 || Math.abs(value.remainingAmount - value.patientAmount + value.paidAmount) > 0.001) {
      throw new Error('Booking outcome could not be verified. Reconcile before retrying.');
    }
    return value;
  }
  create(request: BookingRequest) {
    return defer(() => {
      const wasUncertain = !!this.uncertainKey();
      if (this.uncertainKey() && this.uncertainKey() !== request.idempotencyKey) throw new Error('Reconcile the pending booking first.');
      this.setKey(request.idempotencyKey);
      return this.http.post<BookingReceipt>(this.url, request).pipe(
        map(value => { if (value?.idempotencyKey !== request.idempotencyKey) throw new Error('Booking outcome could not be verified: returned identity mismatch.'); return this.receipt(value); }),
        tap(() => { this.setKey(null); this.events.changed.next('appointments'); this.events.changed.next('billing'); }),
        catchError(error => {
          // A confirmed validation rejection rolled back the transaction. Timeouts and unreadable success responses remain unknown.
          if (!wasUncertain && error instanceof HttpErrorResponse && !unknownOutcome(error) && !['Booking.ConcurrentChange', 'Booking.RetryKeyConflict'].includes(error.error?.title)) this.setKey(null);
          return throwError(() => error);
        })
      );
    });
  }
  reconcile() {
    const key = this.uncertainKey();
    if (!key) return throwError(() => new Error('No pending booking to reconcile.'));
    return this.http.get<BookingReceipt>(`${this.url}/operations/${encodeURIComponent(key)}`).pipe(
      map(value => { if (value?.idempotencyKey !== key) throw new Error('Booking outcome could not be verified.'); return this.receipt(value); }), tap(() => this.setKey(null))
    );
  }
  completeAssessment(request: { appointmentId: number; diagnosis: string; numberOfSessions: number; frequencyPerWeek: number; doctorId: string; treatmentType: string; exercises: string | null }) {
    return this.http.post<BookingPlan>(`${this.url}/assessments/complete`, request).pipe(map(plan => {
      if (!Number.isSafeInteger(plan?.id) || plan.id <= 0 || plan.doctorId !== request.doctorId || plan.plannedSessions !== request.numberOfSessions)
        throw new Error('Assessment outcome could not be verified. Check the saved assessment before retrying.');
      return plan;
    }));
  }
}
