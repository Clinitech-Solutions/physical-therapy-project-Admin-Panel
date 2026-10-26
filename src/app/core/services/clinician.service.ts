import { Injectable, inject, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { finalize, map, tap } from "rxjs";
import { environment } from "../../../environments/environment";
import { apiError, record, ReceptionError, textField } from "./reception-api";

export interface Clinician {
  id: string;
  name: string;
  gender?: "Male" | "Female";
  roles: string[];
}
/** Uses the existing Users/GetAll envelope; authorization/response verification is pending. */
export function decodeClinicians(value: unknown): Clinician[] {
  const users = record(value)["value"];
  if (!Array.isArray(users))
    throw new ReceptionError(
      "CLINICIAN_RESPONSE_PENDING",
      "Clinician lookup response and Receptionist access need verification.",
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
        name: textField(user["fullName"]),
        roles,
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
  load() {
    this.loading.set(true);
    this.error.set(null);
    this.http
      .get<unknown>(`${environment.apiUrl}/Users/GetAll`)
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
