import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, defer, map, tap, throwError, shareReplay, Observable, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BookingAccount, BookingClinician, BookingContext, BookingPlan, BookingPreview, BookingReceipt, BookingRequest, BookingPaymentMethod } from '../models/booking.model';
import { numericId, ReceptionEvents, unknownOutcome, ReceptionError } from './reception-api';
import { pagedRecords } from './reception-pagination';
import { Patient } from '../models/patient.model';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

const storageKey = 'ptcenter.pending-booking-key';
function pendingKey(): string | null {
  try { return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(storageKey); } catch { return null; }
}
@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly http = inject(HttpClient);
  private readonly events = inject(ReceptionEvents);
  private readonly url = `${environment.apiUrl}/Bookings`;
  constructor() { this.events.changed.pipe(takeUntilDestroyed()).subscribe(() => this.contextCache.clear()); }
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
  private readonly contextCache = new Map<number, {expires: number; value: Observable<BookingContext>}>();
  private readonly clinicianCache = new Map<string, {expires: number; value: Observable<BookingClinician[]>}>();
  invalidatePatient(id: number) { this.contextCache.delete(id); this.clinicianCache.clear(); }
  context(id: number) {
    const cached = this.contextCache.get(id);
    if (cached && cached.expires > Date.now()) return cached.value;
    const value = this.http.get<BookingContext>(`${this.url}/patients/${numericId(id)}`).pipe(
      tap(result => this.contextCache.set(id, {expires: Date.now() + 30000, value: of(result)})),
      catchError(error => { this.contextCache.delete(id); return throwError(() => error); }), shareReplay({bufferSize: 1, refCount: true}));
    this.contextCache.set(id, {expires: Date.now() + 30000, value}); return value;
  }
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
    const key = `${id}:${planId}:${treatment}`; const cached = this.clinicianCache.get(key);
    if (cached && cached.expires > Date.now()) return cached.value;
    const value = this.http.get<BookingClinician[]>(`${this.url}/patients/${numericId(id)}/clinicians`, {
      params: { ...(planId == null ? {} : { planId }), ...(treatment ? { treatment: true } : {}) }
    }).pipe(tap(result => this.clinicianCache.set(key, {expires: Date.now() + 30000, value: of(result)})), catchError(error => { this.clinicianCache.delete(key); return throwError(() => error); }), shareReplay({bufferSize: 1, refCount: true}));
    this.clinicianCache.set(key, {expires: Date.now() + 30000, value}); return value;
  }
  preview(request: BookingRequest) { return this.http.post<BookingPreview>(`${this.url}/preview`, request).pipe(map(quote => {
    if (!quote || ![quote.totalAmount, quote.patientAmount, quote.insuranceAmount, quote.deposit, quote.remainingAmount, quote.discountAmount].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0))
      throw new ReceptionError('BOOKING_QUOTE_UNVERIFIED', 'Booking amounts could not be verified. Refresh the booking details or contact your administrator.');
    return quote;
  })); }
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
        tap(() => { this.invalidatePatient(request.patientId); this.setKey(null); this.events.changed.next('appointments'); }),
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
