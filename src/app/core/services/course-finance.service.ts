import { Injectable, inject } from "@angular/core";
import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import {
  catchError,
  defer,
  finalize,
  map,
  tap,
  throwError,
  timeout,
} from "rxjs";
import { environment } from "../../../environments/environment";
import {
  BookingPaymentMethod,
  InsuranceAccounts,
  PaymentGate,
} from "../models/booking.model";
import {
  numericId,
  ReceptionError,
  ReceptionEvents,
  unknownOutcome,
} from "./reception-api";
import { SessionPaymentPrompt } from "./session-payment-prompt";

export interface FinancialIntent {
  scope: string;
  key: string;
  body: Record<string, number | string>;
}
@Injectable({ providedIn: "root" })
export class CourseFinanceService {
  private readonly http = inject(HttpClient);
  private readonly events = inject(ReceptionEvents);
  private readonly url = `${environment.apiUrl}/Finance`;
  private readonly active = new Set<string>();
  private readonly memory = new Map<string, FinancialIntent>();
  readonly blockedAppointment = inject(SessionPaymentPrompt).appointment;
  pending(scope: string): FinancialIntent | null {
    try {
      return (
        this.memory.get(scope) ??
        JSON.parse(
          sessionStorage.getItem(`ptcenter.finance.intent.${scope}`) ?? "null",
        )
      );
    } catch {
      return this.memory.get(scope) ?? null;
    }
  }
  private pendingOperations(): FinancialIntent[] {
    const values = new Map(this.memory);
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)!;
        if (key.startsWith("ptcenter.finance.intent.")) {
          const value = JSON.parse(sessionStorage.getItem(key)!);
          values.set(value.scope, value);
        }
      }
    } catch {
      /* In-memory recovery remains available. */
    }
    return [...values.values()];
  }
  pendingInsurance() {
    return this.pendingOperations().filter(
      (value) =>
        value.scope.startsWith("claim-") || value.scope.startsWith("settle-"),
    );
  }
  pendingPatients() {
    return this.pendingOperations().filter((value) =>
      value.scope.startsWith("patient-"),
    );
  }
  private remember(value: FinancialIntent) {
    this.memory.set(value.scope, value);
    try {
      sessionStorage.setItem(
        `ptcenter.finance.intent.${value.scope}`,
        JSON.stringify(value),
      );
      sessionStorage.setItem(`ptcenter.finance.${value.scope}`, value.key);
    } catch {}
  }
  private finish(scope: string) {
    this.memory.delete(scope);
    try {
      sessionStorage.removeItem(`ptcenter.finance.intent.${scope}`);
      sessionStorage.removeItem(`ptcenter.finance.${scope}`);
    } catch {}
  }
  private operation<T>(
    scope: string,
    fallback: string,
    body: Record<string, number | string>,
    action: (key: string) => import("rxjs").Observable<T>,
  ) {
    return defer(() => {
      if (this.active.has(scope))
        throw new ReceptionError(
          "OPERATION_IN_PROGRESS",
          "A receipt operation is already in progress.",
        );
      const previous = this.pending(scope);
      if (previous && JSON.stringify(previous.body) !== JSON.stringify(body))
        throw new ReceptionError(
          "FINANCE_ORIGINAL_RECEIPT_REQUIRED",
          "Recover the original receipt details before making another collection.",
        );
      let key = previous?.key ?? fallback;
      // Retain opaque keys from an older UI; never silently replace an unresolved receipt identity.
      if (!previous) {
        try {
          key = sessionStorage.getItem(`ptcenter.finance.${scope}`) ?? key;
        } catch {}
      }
      this.remember({ scope, key, body });
      this.active.add(scope);
      return defer(() => action(key)).pipe(
        timeout(30000),
        tap(() => this.finish(scope)),
        catchError((error) => {
          if (!previous && !this.needsRetry(error)) this.finish(scope);
          return throwError(() => error);
        }),
        finalize(() => this.active.delete(scope)),
      );
    });
  }
  private verifiedGate(value: PaymentGate, id: number): PaymentGate {
    const amounts = [
      value?.patientPaid,
      value?.requiredCumulative,
      value?.additionalPaymentRequired,
      value?.patientBalance,
    ];
    if (
      value?.appointmentId !== id ||
      typeof value.canStart !== "boolean" ||
      !amounts.every(
        (n) => typeof n === "number" && Number.isFinite(n) && n >= 0,
      ) ||
      Math.abs(
        value.additionalPaymentRequired -
          Math.max(0, value.requiredCumulative - value.patientPaid),
      ) > 0.005 ||
      (value.invoiceId != null &&
        value.canStart !== value.patientPaid >= value.requiredCumulative)
    )
      throw new ReceptionError(
        "OPERATION_OUTCOME_UNKNOWN",
        "The financial response could not be verified. Recover the original receipt before retrying.",
      );
    return value;
  }
  gate(id: number) {
    return this.http
      .get<PaymentGate>(
        `${this.url}/appointments/${numericId(id)}/payment-gate`,
      )
      .pipe(
        timeout(20000),
        map((value) => this.verifiedGate(value, id)),
      );
  }
  collect(
    id: number,
    key: string,
    amount: number,
    method: BookingPaymentMethod,
  ) {
    return this.operation(
      `patient-${numericId(id)}`,
      key,
      { amount, method },
      (stable) =>
        this.http
          .post<PaymentGate>(`${this.url}/appointments/${id}/payments`, {
            idempotencyKey: stable,
            amount,
            method,
          })
          .pipe(map((value) => this.verifiedGate(value, id))),
    ).pipe(tap(() => this.events.changed.next("billing")));
  }
  accounts() {
    return this.http
      .get<InsuranceAccounts>(`${this.url}/insurance/accounts`)
      .pipe(timeout(20000));
  }
  claim(invoiceId: number, key: string, submissionReference: string) {
    submissionReference = submissionReference.trim();
    return this.operation(
      `claim-${numericId(invoiceId)}`,
      key,
      { invoiceId, submissionReference },
      (stable) =>
        this.http
          .post<{ id: number; invoiceId: number }>(
            `${this.url}/insurance/claims`,
            { idempotencyKey: stable, invoiceId, submissionReference },
          )
          .pipe(
            map((value) => {
              if (
                !Number.isSafeInteger(value?.id) ||
                value.id < 1 ||
                value.invoiceId !== invoiceId
              )
                throw new ReceptionError(
                  "OPERATION_OUTCOME_UNKNOWN",
                  "The claim response could not be verified. Recover the original submission.",
                );
              return value;
            }),
          ),
    );
  }
  settle(
    id: number,
    key: string,
    amount: number,
    method: BookingPaymentMethod,
    settlementReference: string,
  ) {
    return this.operation(
      `settle-${numericId(id)}`,
      key,
      { amount, method, settlementReference },
      (stable) =>
        this.http
          .post<{ paymentId: number }>(
            `${this.url}/insurance/claims/${id}/settlements`,
            { idempotencyKey: stable, amount, method, settlementReference },
          )
          .pipe(
            map((value) => {
              if (
                !Number.isSafeInteger(value?.paymentId) ||
                value.paymentId < 1
              )
                throw new ReceptionError(
                  "OPERATION_OUTCOME_UNKNOWN",
                  "The insurer receipt response could not be verified. Recover the original receipt.",
                );
              return value;
            }),
          ),
    ).pipe(tap(() => this.events.changed.next("billing")));
  }
  needsRetry(error: unknown) {
    return (
      !(error instanceof HttpErrorResponse) ||
      unknownOutcome(error) ||
      ["Booking.ConcurrentChange", "Booking.RetryKeyConflict"].includes(
        error.error?.title,
      )
    );
  }
}
