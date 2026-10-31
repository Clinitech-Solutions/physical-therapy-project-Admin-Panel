import { HttpErrorResponse } from "@angular/common/http";
import { Injectable, signal } from "@angular/core";
import {
  Observable,
  Subject,
  catchError,
  defer,
  finalize,
  tap,
  throwError,
} from "rxjs";
import { patientServerError } from "./patient-registration";

export class ReceptionError extends Error {
  constructor(
    public readonly key: string,
    message: string,
  ) {
    super(message);
  }
}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ReceptionError(
      "RESPONSE_CONTRACT_PENDING",
      "The server response needs verification. No sample records were substituted.",
    );
  return value as Record<string, unknown>;
}
export function numericId(value: unknown): number {
  if (
    (typeof value !== "string" && typeof value !== "number") ||
    !/^\d+$/.test(String(value)) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) < 1 ||
    Number(value) > 2147483647
  ) {
    throw new ReceptionError(
      "INVALID_IDENTIFIER",
      "Select a valid record identifier.",
    );
  }
  return Number(value);
}
export function textField(value: unknown): string {
  if (typeof value !== "string")
    throw new ReceptionError(
      "RESPONSE_CONTRACT_PENDING",
      "The server response needs verification. No sample records were substituted.",
    );
  return value;
}
export function finiteNumber(value: unknown): number {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    String(value).trim() === "" ||
    !Number.isFinite(Number(value))
  ) {
    throw new ReceptionError(
      "RESPONSE_CONTRACT_PENDING",
      "The server response needs verification. No sample records were substituted.",
    );
  }
  return Number(value);
}
export function apiError(error: unknown): string {
  if (error instanceof ReceptionError) return error.key;
  if (
    error instanceof HttpErrorResponse &&
    (error.status === 401 || error.status === 403)
  )
    return "RECEPTION_ACCESS_REQUIRED";
  if(error instanceof HttpErrorResponse){
    if(error.status>=500 || error.status===0)return 'REQUEST_FAILED_SAFE';
    const code=error.error?.title ?? error.error?.code;
    if(typeof code==='string' && code.startsWith('Booking.') && code!=='Booking.Validation')return 'BOOKING_RULE_'+code.slice(8).replace(/([a-z])([A-Z])/g,'$1_$2').toUpperCase();
    if(error.status===409)return 'BUSINESS_REVIEW_REQUIRED';
    if(error.status===400 || error.status===422)return 'VALIDATION_REVIEW_REQUIRED';
  }
  return 'REQUEST_FAILED_SAFE';
}
export function unknownOutcome(error: unknown): boolean {
  if (error instanceof Error && error.name === "TimeoutError") return true;
  return (
    error instanceof HttpErrorResponse &&
    (error.status === 0 ||
      error.status === 408 ||
      error.status >= 500 ||
      (error.status >= 200 && error.status < 300))
  );
}
export function localDay(date: Date | string): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function clinicDay(value: Date | string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  return ['year','month','day'].map(type=>parts.find(part=>part.type===type)?.value).join('-');
}

@Injectable({ providedIn: "root" })
export class ReceptionEvents {
  readonly changed = new Subject<
    "rooms" | "appointments" | "billing" | "patients" | "clinical"
  >();
}

/** No mutation retries: an unknown outcome requires reconciliation before another write. */
export class MutationState {
  readonly busy = signal(false);
  readonly uncertain = signal(false);
  run<T>(request: () => Observable<T>): Observable<T> {
    return defer(() => {
      if (this.busy())
        throw new ReceptionError(
          "OPERATION_IN_PROGRESS",
          "An operation is already in progress.",
        );
      if (this.uncertain())
        throw new ReceptionError(
          "OPERATION_OUTCOME_UNKNOWN",
          "The previous operation may have succeeded. Refresh and verify the record before trying again.",
        );
      this.busy.set(true);
      return defer(request).pipe(
        catchError((error) => {
          if (unknownOutcome(error)) this.uncertain.set(true);
          return throwError(() => error);
        }),
        finalize(() => this.busy.set(false)),
      );
    });
  }
}
