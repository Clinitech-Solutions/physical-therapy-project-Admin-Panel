import { Injectable, inject, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { forkJoin, map, finalize, catchError, of } from "rxjs";
import { environment } from "../../../environments/environment";
import {
  AssessmentRecord,
  TreatmentPlanRecord,
  TreatmentPlanSessionRecord,
} from "../models/clinical-api.model";
import {
  apiError,
  finiteNumber,
  numericId,
  record,
  ReceptionError,
  textField,
} from "./reception-api";

@Injectable({ providedIn: "root" })
export class ClinicalRecordsService {
  private http = inject(HttpClient);
  readonly assessments = signal<AssessmentRecord[]>([]);
  readonly plans = signal<TreatmentPlanRecord[]>([]);
  readonly sessions = signal<TreatmentPlanSessionRecord[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  private generation = 0;
  private list<T>(path: string) {
    return this.http.get<unknown>(`${environment.apiUrl}/${path}`).pipe(
      map((data) => {
        if (!Array.isArray(data))
          throw new ReceptionError(
            "RESPONSE_CONTRACT_PENDING",
            "The clinical record response needs verification.",
          );
        return data.map((value) => {
          const r = { ...record(value) };
          r["id"] = numericId(r["id"]);
          const fields = path.startsWith("Assessments/")
            ? ["patientId", "status"]
            : path.startsWith("TreatmentPlans/")
              ? [
                  "assessmentId",
                  "numberOfSessions",
                  "completedSessions",
                  "progressPercentage",
                  "frequencyPerWeek",
                  "status",
                ]
              : ["treatmentPlanId", "sessionNumber", "paymentStatus", "status"];
          for (const key of fields) r[key] = finiteNumber(r[key]);
          if (path.startsWith("TreatmentPlans/"))
            r["doctorId"] = textField(r["doctorId"]);
          if (path.startsWith("Assessments/"))
            r["seniorId"] = textField(r["seniorId"]);
          return r as unknown as T;
        });
      }),
    );
  }
  load(patientId?: number) {
    const generation = ++this.generation;
    this.loading.set(true);
    this.error.set(null);
    this.assessments.set([]);
    this.plans.set([]);
    this.sessions.set([]);
    const safe = <T>(source: import("rxjs").Observable<T[]>) =>
      source.pipe(
        map((data) => ({ data, error: null as string | null })),
        catchError((error) => of({ data: null, error: apiError(error) })),
      );
    forkJoin({
      assessments: safe(
        this.list<AssessmentRecord>(
          `Assessments/GetAll${patientId ? "?patientId=" + numericId(patientId) : ""}`,
        ),
      ),
      plans: safe(this.list<TreatmentPlanRecord>("TreatmentPlans/GetAll")),
      sessions: safe(
        this.list<TreatmentPlanSessionRecord>("TreatmentPlanSessions/GetAll"),
      ),
    })
      .pipe(
        finalize(() => {
          if (generation === this.generation) this.loading.set(false);
        }),
      )
      .subscribe({
        next: (data) => {
          if (generation !== this.generation) return;
          if (data.assessments.data)
            this.assessments.set(data.assessments.data);
          if (data.plans.data) this.plans.set(data.plans.data);
          if (data.sessions.data) this.sessions.set(data.sessions.data);
          this.error.set(
            [data.assessments.error, data.plans.error, data.sessions.error]
              .filter(Boolean)
              .join(" | ") || null,
          );
        },
        error: (e) => {
          if (generation === this.generation) this.error.set(apiError(e));
        },
      });
  }
  plansForPatient(patientId: number) {
    const ids = new Set(
      this.assessments()
        .filter((a) => Number(a.patientId) === patientId)
        .map((a) => Number(a.id)),
    );
    return this.plans().filter((p) => ids.has(Number(p.assessmentId)));
  }
}
