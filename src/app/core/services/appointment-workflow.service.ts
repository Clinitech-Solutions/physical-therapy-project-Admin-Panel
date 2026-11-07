import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { tap, catchError, throwError, EMPTY } from "rxjs";
import { ReceptionistLocale } from '../../shared/receptionist-locale';
import { SessionPaymentPrompt } from './session-payment-prompt';
import { environment } from "../../../environments/environment";
import { MutationState, numericId, ReceptionEvents } from "./reception-api";
import { ReceptionContracts } from "./reception-contracts";

@Injectable({ providedIn: "root" })
export class AppointmentWorkflowService {
  private http = inject(HttpClient);
  private contracts = inject(ReceptionContracts);
  private events = inject(ReceptionEvents);
  private paymentPrompt = inject(SessionPaymentPrompt);
  readonly mutation = new MutationState();
  private readonly locale = new ReceptionistLocale();
  private readonly pendingClosures = new Map<string, {idempotencyKey: string; reason: string}>();
  canTransition(status: string) {
    return this.contracts.has("appointmentStatus", status);
  }
  transition(id: number, status: "In Progress" | "Completed") {
    return this.mutation
      .run(() =>
        this.http.put<unknown>(
          `${environment.apiUrl}/Receptionist/appointments/${numericId(id)}/status`,
          this.contracts.value("appointmentStatus", status),
          { headers: { "Content-Type": "application/json" } },
        ),
      )
      .pipe(tap(() => this.events.changed.next("appointments")), catchError(error => {
        if (status === 'In Progress' && ['Booking.PaymentCoverageRequired', 'Booking.FinancialAgreementRequired'].includes(error?.error?.title ?? error?.error?.code)) this.paymentPrompt.appointment.set(id);
        return throwError(() => error);
      }));
  }
  cancel(id: number, reason?: string) { return this.closeUnattended(id, 'cancel', reason); }
  noShow(id: number, reason?: string) { return this.closeUnattended(id, 'no-show', reason); }
  private closeUnattended(id: number, action: 'cancel'|'no-show', reason?: string) {
    const scope = `${action}:${numericId(id)}`;
    const prior = this.pendingClosures.get(scope);
    const locale = this.locale;
    const entered = reason ?? prior?.reason ?? globalThis.prompt(locale.language === 'ar-EG'
      ? (action === 'no-show' ? 'سبب تسجيل عدم الحضور' : 'سبب إلغاء الموعد')
      : (action === 'no-show' ? 'Reason for recording no-show' : 'Reason for cancelling this appointment'));
    if (!entered?.trim()) return EMPTY;
    const body = prior?.reason === entered.trim() ? prior : { idempotencyKey: crypto.randomUUID(), reason: entered.trim() };
    this.pendingClosures.set(scope, body);
    return this.mutation
      .run(() =>
        this.http.put<unknown>(
          `${environment.apiUrl}/Receptionist/appointments/${numericId(id)}/${action}`,
          body,
        ),
      )
      .pipe(tap(() => { this.pendingClosures.delete(scope); this.events.changed.next("appointments"); }));
  }
}
