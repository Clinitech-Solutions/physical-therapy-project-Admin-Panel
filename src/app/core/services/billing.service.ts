import { Injectable, computed, inject, signal } from "@angular/core";
import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { Observable, throwError, map, tap, finalize, catchError } from "rxjs";
import { environment } from "../../../environments/environment";
import {
  apiError,
  finiteNumber,
  localDay,
  MutationState,
  numericId,
  record,
  ReceptionError,
  ReceptionEvents,
  textField,
  unknownOutcome,
} from "./reception-api";
import { ReceptionContracts, backendEnumNumber } from "./reception-contracts";

export interface Invoice {
  id: number;
  invoiceNumber?: string;
  appointmentId: number | null;
  patientId: number;
  patientName?: string;
  patientPhone?: string | null;
  insuranceCompany?: string | null;
  type: number | string;
  status: number | string;
  totalAmount: number;
  insuranceAmount: number;
  patientAmount: number;
  paidAmount?: number;
  remainingAmount?: number;
  remainingBalance?: number;
  appointmentDate?: string | null;
  courseAgreementId?: number | null;
  treatmentPlanSessionId?: number | null;
  deliveredAt?: string | null;
  createdAt?: string;
  paymentMethod?: number | string | null;
  payments?: Payment[];
  appointmentDetails?: string;
}
export interface CreateInvoiceDto {
  appointmentId: number;
  patientId: number;
  type: number;
  totalAmount: number;
  insuranceAmount: number;
  patientAmount: number;
}
export interface Payment {
  id?: number;
  idempotencyKey?: string;
  invoiceId: number;
  amount: number;
  method: number | string;
  payerType?: string; collectionMethod?: string | null; insuranceClaimId?: number | null; transactionId?: string | null;
  paymentDate?: string;
  createdAt?: string;
}
export interface CreatePaymentDto {
  invoiceId: number;
  amount: number;
  method: number;
}
@Injectable({ providedIn: "root" })
export class BillingService {
  private http = inject(HttpClient, { optional: true });
  private contracts = inject(ReceptionContracts, { optional: true });
  private events = inject(ReceptionEvents, { optional: true });
  private url = `${environment.apiUrl}/Billing`;
  readonly invoices = signal<Invoice[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly mutation = new MutationState();
  readonly pendingPaymentInvoices = signal<number[]>([]);
  private expectedPaid = new Map<number, number>();
  private readGeneration = 0;
  private paymentKeys: Record<string, string> = this.readPaymentKeys();
  get unresolvedInvoicePaymentIds(): number[] { return Object.keys(this.paymentKeys).map(Number); }
  constructor() { if (Object.keys(this.paymentKeys).length) this.mutation.uncertain.set(true); }
  private readPaymentKeys(): Record<string, string> {
    try { return typeof sessionStorage === 'undefined' ? {} : JSON.parse(sessionStorage.getItem('ptcenter.pending-invoice-payment-keys') ?? '{}'); } catch { return {}; }
  }
  private savePaymentKey(invoiceId: number, key: string | null) {
    if (key) this.paymentKeys[invoiceId] = key; else delete this.paymentKeys[invoiceId];
    try { if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('ptcenter.pending-invoice-payment-keys', JSON.stringify(this.paymentKeys)); } catch { /* Keep the retry identity in memory. */ }
  }
  readonly todayInvoices = computed(() =>
    this.invoices().filter(
      (i) => !!i.createdAt && localDay(i.createdAt) === localDay(new Date()),
    ),
  );
  readonly expectedTodayRevenue = computed(() =>
    this.todayInvoices().reduce((sum, i) => sum + i.totalAmount, 0),
  );
  // Cumulative invoice paidAmount cannot identify collections on a particular day or method.
  readonly collectedTodayRevenue = computed<number | null>(() => null);
  readonly cashCollectedToday = computed<number | null>(() => null);
  readonly digitalCollectedToday = computed<number | null>(() => null);
  readonly collectionRateToday = computed<number | null>(() => null);
  readonly pendingTodayRevenue = computed(() =>
    this.invoices().reduce((sum, i) => sum + (i.remainingAmount ?? 0), 0),
  );
  readonly pendingPaymentsCount = computed(
    () => this.invoices().filter((i) => (i.remainingAmount ?? 0) > 0).length,
  );
  get paymentMethods(): string[] {
    return Object.keys(this.contracts?.enums.paymentMethod ?? {});
  }
  mapTypeToNumber(value: string | number): number {
    return this.enumValue("invoiceType", value);
  }
  mapStatusToNumber(value: string | number): number {
    return this.enumValue("invoiceStatus", value);
  }
  mapPaymentMethodToNumber(value: string | number): number {
    return this.enumValue("paymentMethod", value);
  }
  private enumValue(
    kind: "invoiceType" | "invoiceStatus" | "paymentMethod",
    value: string | number,
  ) {
    if (!this.contracts)
      throw new ReceptionError(
        "ENUM_DEFINITION_PENDING",
        "This operation needs confirmed backend enum definitions.",
      );
    return this.contracts.value(kind, value);
  }
  mapTypeToString(value: unknown): string {
    return (
      this.contracts?.label("invoiceType", value) ??
      (typeof value === "string" ? value : "Unknown")
    );
  }
  mapStatusToString(value: unknown): string {
    return (
      this.contracts?.label("invoiceStatus", value) ??
      (typeof value === "string" ? value : "Unknown")
    );
  }
  mapMethodToString(value: unknown): string {
    return (
      this.contracts?.label("paymentMethod", value) ??
      (typeof value === "string" ? value : "Unknown")
    );
  }
  normalizeInvoice(value: unknown): Invoice {
    const r = record(value);
    const remaining = finiteNumber(r["remainingAmount"]);
    return {
      id: numericId(r["id"]),
      invoiceNumber: textField(r["invoiceNumber"]),
      appointmentId: r["appointmentId"] == null ? null : numericId(r["appointmentId"]),
      courseAgreementId: r['courseAgreementId'] == null ? null : numericId(r['courseAgreementId']),
      treatmentPlanSessionId: r['treatmentPlanSessionId'] == null ? null : numericId(r['treatmentPlanSessionId']),
      deliveredAt: r['deliveredAt'] as string | null,
      patientId: numericId(r["patientId"]),
      patientName: textField(r["patientName"]),
      patientPhone: r["patientPhone"] as string | null,
      insuranceCompany: r["insuranceCompany"] as string | null,
      type: finiteNumber(backendEnumNumber('invoiceType', r["type"])),
      status: finiteNumber(backendEnumNumber('invoiceStatus', r["status"])),
      totalAmount: finiteNumber(r["totalAmount"]),
      insuranceAmount: finiteNumber(r["insuranceAmount"]),
      patientAmount: finiteNumber(r["patientAmount"]),
      paidAmount: finiteNumber(r["paidAmount"]),
      remainingAmount: remaining,
      remainingBalance: remaining,
      appointmentDate: r['appointmentDate'] == null ? null : textField(r['appointmentDate']),
      createdAt: textField(r["createdAt"]),
      paymentMethod: r["paymentMethod"] as string | null,
    };
  }
  findInvoiceById(id: number | string | null | undefined) {
    return this.invoices().find((i) => String(i.id) === String(id));
  }
  getInvoiceBySessionId(id: number | string | null | undefined) {
    return this.invoices().find((i) => String(i.appointmentId) === String(id));
  }
  private cache(items: Invoice[]) {
    this.invoices.set(items);
    for (const item of items) {
      const expected = this.expectedPaid.get(item.id);
      if (expected !== undefined && (item.paidAmount ?? 0) >= expected) {
        this.expectedPaid.delete(item.id);
        this.pendingPaymentInvoices.update((ids) =>
          ids.filter((id) => id !== item.id),
        );
      }
    }
  }
  getInvoices() {
    if (!this.http) {
      this.error.set("HTTP client unavailable.");
      return;
    }
    const generation = ++this.readGeneration;
    this.loading.set(true);
    this.error.set(null);
    this.http
      .get<unknown>(`${this.url}/invoices`)
      .pipe(
        map((value) => {
          if (!Array.isArray(value))
            throw new ReceptionError(
              "RESPONSE_CONTRACT_PENDING",
              "The invoice list response needs verification.",
            );
          return value.map((v) => this.normalizeInvoice(v));
        }),
        finalize(() => {
          if (generation === this.readGeneration) this.loading.set(false);
        }),
      )
      .subscribe({
        next: (items) => {
          if (generation === this.readGeneration) this.cache(items);
        },
        error: (e) => {
          if (generation === this.readGeneration) this.error.set(apiError(e));
        },
      });
  }
  getInvoiceById(id: number): Observable<Invoice> {
    if (!this.http)
      return throwError(() => new Error("HTTP client unavailable."));
    return this.http.get<unknown>(`${this.url}/invoices/${numericId(id)}`).pipe(
      map((value) => this.normalizeInvoice(value)),
      tap((item) =>
        this.cache([item, ...this.invoices().filter((i) => i.id !== item.id)]),
      ),
    );
  }
  createInvoice(data: CreateInvoiceDto): Observable<unknown> {
    return this.mutation
      .run(() => {
        if (!this.http) throw new Error("HTTP client unavailable.");
        const payload = {
          ...data,
          appointmentId: numericId(data.appointmentId),
          patientId: numericId(data.patientId),
          type: this.enumValue("invoiceType", data.type),
        };
        if (
          [
            payload.totalAmount,
            payload.insuranceAmount,
            payload.patientAmount,
          ].some((v) => !Number.isFinite(v) || v < 0)
        )
          throw new ReceptionError(
            "INVALID_AMOUNT",
            "Enter valid invoice amounts.",
          );
        return this.http.post<unknown>(`${this.url}/invoices`, payload);
      })
      .pipe(tap(() => this.events?.changed.next("billing")));
  }
  deleteInvoice(id: number): Observable<unknown> {
    return this.mutation
      .run(() => {
        if (!this.http) throw new Error("HTTP client unavailable.");
        return this.http.delete<unknown>(
          `${this.url}/invoices/${numericId(id)}`,
        );
      })
      .pipe(tap(() => this.events?.changed.next("billing")));
  }
  updateInvoiceStatus(id: number, status: number): Observable<unknown> {
    return this.mutation
      .run(() => {
        if (!this.http) throw new Error("HTTP client unavailable.");
        return this.http.patch<unknown>(
          `${this.url}/invoices/${numericId(id)}/status`,
          { status: this.enumValue("invoiceStatus", status) },
        );
      })
      .pipe(tap(() => this.events?.changed.next("billing")));
  }
  getPaymentsForInvoice(invoiceId: number): Observable<Payment[]> {
    if (!this.http)
      return throwError(() => new Error("HTTP client unavailable."));
    return this.http
      .get<unknown>(`${this.url}/invoices/${numericId(invoiceId)}/payments`)
      .pipe(
        map((value) => {
          if (!Array.isArray(value))
            throw new ReceptionError(
              "PAYMENT_HISTORY_PENDING",
              "The payment history response needs verification.",
            );
          return value.map((value) => {
            const r = record(value);
            if (numericId(r["invoiceId"]) !== invoiceId)
              throw new ReceptionError(
                "PAYMENT_HISTORY_PENDING",
                "Payment history did not match the selected invoice.",
              );
            return {
              id: r['id'] == null ? undefined : numericId(r['id']),
              idempotencyKey: typeof r['idempotencyKey'] === 'string' ? r['idempotencyKey'] : undefined,
              invoiceId: numericId(r["invoiceId"]),
              amount: finiteNumber(r["amount"]),
              method: finiteNumber(backendEnumNumber('paymentMethod', r["paymentMethod"] ?? r["method"])),
              payerType: r['payerType'] as string | undefined, collectionMethod: r['collectionMethod'] as string | null,
              insuranceClaimId: r['insuranceClaimId'] as number | null, transactionId: r['transactionId'] as string | null,
            };
          });
        }),
        tap(payments => {
          const key = this.paymentKeys[invoiceId]; if (!key) return;
          const saved = payments.some(p => p.idempotencyKey === `invoice:${invoiceId}:${key}`);
          if (saved) { this.savePaymentKey(invoiceId, null); this.getInvoices(); }
          // If not yet committed, retain this key for an explicit retry; never create a fresh collection identity.
          this.mutation.uncertain.set(Object.keys(this.paymentKeys).some(id => Number(id) !== invoiceId));
        }),
      );
  }
  recordPayment(data: CreatePaymentDto): Observable<unknown> {
    return this.mutation
      .run(() => {
        if (!this.http) throw new Error("HTTP client unavailable.");
        const invoiceId = numericId(data.invoiceId),
          invoice = this.findInvoiceById(invoiceId);
        if (this.pendingPaymentInvoices().includes(invoiceId))
          throw new ReceptionError(
            "PAYMENT_RECONCILIATION_REQUIRED",
            "A payment was saved for this invoice. Verify its refreshed balance before collecting again.",
          );
        if (
          !invoice ||
          !Number.isFinite(data.amount) ||
          data.amount < 0.01 ||
          data.amount > 999999999 ||
          data.amount > (invoice.remainingAmount ?? 0)
        )
          throw new ReceptionError(
            "PAYMENT_AMOUNT_INVALID",
            "Enter a positive payment no greater than the saved invoice balance.",
          );
        const wasUncertain = !!this.paymentKeys[invoiceId];
        const key = this.paymentKeys[invoiceId] ?? crypto.randomUUID();
        this.savePaymentKey(invoiceId, key);
        const payload = {
          idempotencyKey: key,
          invoiceId,
          amount: data.amount,
          method: this.enumValue("paymentMethod", data.method),
        };
        return this.http.post<unknown>(`${this.url}/payments`, payload).pipe(
          map(value => {
            const payment = value as Record<string, unknown> | null;
            if (!payment || !Number.isSafeInteger(Number(payment['id'])) || Number(payment['id']) <= 0 || Number(payment['invoiceId']) !== invoiceId || Number(payment['amount']) !== data.amount) {
              this.mutation.uncertain.set(true);
              throw new ReceptionError('OPERATION_OUTCOME_UNKNOWN', 'The payment response could not be verified. Check its saved payment history before retrying.');
            }
            return value;
          }),
          tap(() => {
            this.savePaymentKey(invoiceId, null);
            this.expectedPaid.set(
              invoiceId,
              (invoice.paidAmount ?? 0) + data.amount,
            );
            this.pendingPaymentInvoices.update((ids) => [
              ...new Set([...ids, invoiceId]),
            ]);
          }),
          catchError(error => {
            if (!wasUncertain && error instanceof HttpErrorResponse && !unknownOutcome(error) && error.error?.code !== 'Billing.RetryKeyConflict') this.savePaymentKey(invoiceId, null);
            return throwError(() => error);
          }),
        );
      })
      .pipe(tap(() => this.events?.changed.next("billing")));
  }
}
