import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { tap, catchError, throwError } from "rxjs";
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
  cancel(id: number) {
    return this.mutation
      .run(() =>
        this.http.put<unknown>(
          `${environment.apiUrl}/Receptionist/appointments/${numericId(id)}/cancel`,
          null,
        ),
      )
      .pipe(tap(() => this.events.changed.next("appointments")));
  }
}
