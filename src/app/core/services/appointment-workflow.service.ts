import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { tap } from "rxjs";
import { environment } from "../../../environments/environment";
import { MutationState, numericId, ReceptionEvents } from "./reception-api";
import { ReceptionContracts } from "./reception-contracts";

@Injectable({ providedIn: "root" })
export class AppointmentWorkflowService {
  private http = inject(HttpClient);
  private contracts = inject(ReceptionContracts);
  private events = inject(ReceptionEvents);
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
      .pipe(tap(() => this.events.changed.next("appointments")));
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
