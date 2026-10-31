import { Injectable, inject, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { finalize, map, tap, Subscription } from "rxjs";
import { environment } from "../../../environments/environment";
import { apiError, record, ReceptionError, textField } from "./reception-api";

export interface Clinician {
  id: string;
  name: string;
  gender?: "Male" | "Female";
  roles: string[];
  currentLoad?: number;
  workingHours?: {dayOfWeek: number; startTime: string; endTime: string}[];
  absenceDates?: string[];
}
/** Minimal clinical directory; never queries staff-account administration. */
export function decodeClinicians(value: unknown): Clinician[] {
  const users = value;
  if (!Array.isArray(users))
    throw new ReceptionError(
      "CLINICIAN_RESPONSE_PENDING",
      "The clinician directory response could not be verified.",
    );
  return users
    .map((value) => {
      const user = record(value);
      const roles = user["roles"];
      if (!Array.isArray(roles) || !roles.every((r) => typeof r === "string"))
        throw new ReceptionError(
          "CLINICIAN_RESPONSE_PENDING",
          "Clinician lookup response and Receptionist access need verification.",
        );
      return {
        id: textField(user["id"]),
        name: textField(user["name"]),
        roles,
        currentLoad: typeof user['currentLoad'] === 'number' ? user['currentLoad'] : undefined,
        workingHours: Array.isArray(user['workingHours']) ? user['workingHours'] : undefined,
        absenceDates: Array.isArray(user['absenceDates']) ? user['absenceDates'] : undefined,
        gender:
          user["gender"] === 0 || user["gender"] === "Male"
            ? ("Male" as const)
            : user["gender"] === 1 || user["gender"] === "Female"
              ? ("Female" as const)
              : undefined,
      };
    })
    .filter((u) => u.roles.some((r) => r === "Doctor" || r === "Senior"));
}
@Injectable({ providedIn: "root" })
export class ClinicianService {
  private http = inject(HttpClient);
  readonly clinicians = signal<Clinician[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  private request?: Subscription;
  load() {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.request = this.http
      .get<unknown>(`${environment.apiUrl}/Receptionist/clinicians`)
      .pipe(
        map(decodeClinicians),
        tap({
          next: (users) => this.clinicians.set(users),
          error: (e) => this.error.set(apiError(e)),
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({ error: () => {} });
  }
}
