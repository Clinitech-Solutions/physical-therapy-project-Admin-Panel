import { Injectable, inject, signal } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { environment } from "../../../environments/environment";
import { User } from "./user.service";

export interface ClinicIdentity {
  name: string;
  phone: string | null;
  address: string | null;
  email: string | null;
  version: number;
  updatedAt: string | null;
  updatedBy: string | null;
  timezone: string;
  currency: string;
}
export interface Overview {
  generatedAt: string;
  from: string;
  to: string;
  patientCollections: number;
  insurerCollections: number;
  patientOutstanding: number;
  earnedInsurerOutstanding: number;
  plannedInsurerLiability: number;
  scheduled: number;
  clinicallyCompleted: number;
  cancelled: number;
  noShow: number;
  occupied: number;
  activeRoomCapacity: number;
  availableRoomSlots: number;
  unsubmittedServices: number;
  outstandingClaims: number;
  unresolvedAbsenceWork: number;
  collections: { day: string; patient: number; insurer: number }[];
}
export interface ReportRow {
  id: string;
  label: string;
  patient: string | null;
  patientId: number | null;
  companyId: number | null;
  company: string | null;
  clinician: string | null;
  clinicianId: string | null;
  date: string | null;
  amount: number;
  collected: number;
  remaining: number;
  status: string | null;
  method: string | null;
  scheduledEnd: string | null;
  arrivedAt: string | null;
  departedAt: string | null;
  clinicalStart: string | null;
  clinicalEnd: string | null;
  durationSeconds: number | null;
  visitCount: number;
  completedCount: number;
  missingClinicalTimestamps: number;
}
export interface CeoReport {
  kind: string;
  dateBasis: string;
  scope: string;
  generatedAt: string;
  from: string | null;
  to: string | null;
  page: number;
  pageSize: number;
  total: number;
  totals: {
    amount: number;
    collected: number;
    remaining: number;
    rows: number;
    recordedDurationSeconds: number;
    missingClinicalTimestamps: number;
    visitCount: number;
  };
  items: ReportRow[];
  currency: string;
  timezone: string;
}
export interface StaffRow extends User {
  id: string;
  isActive: boolean;
  futureAppointments: number;
  version: string;
}
export interface StaffPage {
  items: StaffRow[];
  total: number;
  page: number;
  pageSize: number;
}
export type Filters = Record<
  string,
  string | number | boolean | null | undefined
>;
@Injectable({ providedIn: "root" })
export class CeoWorkspaceService {
  private readonly http = inject(HttpClient);
  private readonly url = environment.apiUrl + "/ceo";
  readonly identity = signal<ClinicIdentity | null>(null);
  params(q: Filters) {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(q))
      if (v !== null && v !== undefined && v !== "") p = p.set(k, String(v));
    return p;
  }
  overview(q: Filters) {
    return this.http.get<Overview>(this.url + "/overview", {
      params: this.params(q),
    });
  }
  report(kind: string, q: Filters) {
    return this.http.get<CeoReport>(this.url + "/reports/" + kind, {
      params: this.params(q),
    });
  }
  reportOptions() {
    return this.http.get<{
      companies: { id: number; name: string }[];
      clinicians: { id: string; name: string }[];
    }>(this.url + "/report-options");
  }
  export(kind: string, q: Filters) {
    return this.http.get(this.url + "/reports/" + kind + "/export", {
      params: this.params(q),
      responseType: "blob",
    });
  }
  staff(q: Filters) {
    return this.http.get<StaffPage>(this.url + "/staff", {
      params: this.params(q),
    });
  }
  status(row: StaffRow, isActive: boolean) {
    return this.http.put(
      this.url + "/staff/" + encodeURIComponent(row.id) + "/status",
      { isActive, version: row.version },
    );
  }
  settings() {
    return this.http.get<ClinicIdentity>(this.url + "/settings");
  }
  saveSettings(value: Partial<ClinicIdentity>) {
    return this.http.put<ClinicIdentity>(this.url + "/settings", value);
  }
  loadIdentity() {
    this.http
      .get<ClinicIdentity>(environment.apiUrl + "/clinic-identity")
      .subscribe({
        next: (x) => this.identity.set(x),
        error: () => this.identity.set(null),
      });
  }
}
