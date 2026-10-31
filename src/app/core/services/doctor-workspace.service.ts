import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { map, timeout } from "rxjs";
import { TranslateService } from "@ngx-translate/core";
import { environment } from "../../../environments/environment";
import {
  DoctorSchedule,
  DoctorPatientWorkspace,
  NotesMutation,
  CompleteReassessment,
  ReassessmentRequest,
} from "../models/doctor-workspace.model";
import { numericId, ReceptionError } from "./reception-api";

export function clinicDate(value = new Date()): string {
  return value.toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
}
export function clinicalError(
  error: unknown,
  translate: TranslateService,
): string {
  const body = (error as { error?: { title?: string; code?: string } })?.error;
  const key =
    "DOCTOR.ERRORS." +
    (body?.title ?? body?.code ?? "Unknown").replaceAll(".", "_");
  const text = translate.instant(key);
  const conflicts = (body as { details?: { conflicts?: string[] } })?.details
    ?.conflicts;
  return (
    (text !== key ? text : translate.instant("DOCTOR.ERRORS.Unknown")) +
    (Array.isArray(conflicts)
      ? " " +
        conflicts
          .map((c) => translate.instant("DOCTOR.CONFLICTS." + c))
          .join(" ")
      : "")
  );
}
@Injectable({ providedIn: "root" })
export class DoctorWorkspaceService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;
  schedule(date: string) {
    return this.http
      .get<DoctorSchedule>(`${this.base}/Doctor/schedule`, { params: { date } })
      .pipe(
        timeout(20000),
        map((data) => {
          if (
            !data ||
            !Array.isArray(data.appointments) ||
            !Array.isArray(data.activeTreatments)
          )
            throw new ReceptionError(
              "DOCTOR_RESPONSE",
              "Schedule data could not be verified.",
            );
          return data;
        }),
      );
  }
  private workspace(data: DoctorPatientWorkspace, id: number) {
    if (
      !data?.visit ||
      data.visit.appointmentId !== id ||
      !data.plan ||
      data.plan.id !== data.visit.treatmentPlanId ||
      !data.notes ||
      !Number.isSafeInteger(data.notes.version) ||
      data.notes.version < 0 ||
      !Array.isArray(data.documents) ||
      !Array.isArray(data.previousSessions) ||
      !Array.isArray(data.reassessments)
    )
      throw new ReceptionError(
        "DOCTOR_RESPONSE",
        "Clinical data could not be verified.",
      );
    return data;
  }
  get(id: number) {
    return this.http
      .get<DoctorPatientWorkspace>(
        `${this.base}/Doctor/appointments/${numericId(id)}`,
      )
      .pipe(
        timeout(20000),
        map((data) => this.workspace(data,id)),
      );
  }
  start(id: number) {
    return this.http
      .post<DoctorPatientWorkspace>(
        `${this.base}/Doctor/appointments/${numericId(id)}/start`,
        {},
      )
      .pipe(
        timeout(30000),
        map((data) => this.workspace(data,id)),
      );
  }
  save(id: number, notes: NotesMutation, final = false) {
    const path = `${this.base}/Doctor/appointments/${numericId(id)}/${final ? "end" : "notes"}`;
    return (
      final
        ? this.http.post<DoctorPatientWorkspace>(path, notes)
        : this.http.put<DoctorPatientWorkspace>(path, notes)
    ).pipe(
      timeout(30000),
      map((data) => this.workspace(data,id)),
    );
  }
  document(id: number, documentId: number) {
    return this.http
      .get(
        `${this.base}/Doctor/appointments/${numericId(id)}/documents/${numericId(documentId)}`,
        { responseType: "blob" },
      )
      .pipe(timeout(20000));
  }
  requests() {
    return this.http
      .get<ReassessmentRequest[]>(`${this.base}/ReassessmentRequests`)
      .pipe(
        timeout(20000),
        map((data) => {
          if (!Array.isArray(data))
            throw new ReceptionError(
              "DOCTOR_RESPONSE",
              "Review data could not be verified.",
            );
          return data;
        }),
      );
  }
  request(
    id: number,
    request: {
      operationKey: string;
      reasonCategory: string;
      notes: string;
      recommendation: string;
    },
  ) {
    return this.http
      .post<ReassessmentRequest>(
        `${this.base}/ReassessmentRequests/appointments/${numericId(id)}`,
        request,
      )
      .pipe(timeout(30000));
  }
  review(id: number) {
    return this.http
      .get<ReassessmentRequest>(
        `${this.base}/ReassessmentRequests/${numericId(id)}`,
      )
      .pipe(timeout(20000));
  }
  startReview(id: number, expectedVersion: number) {
    return this.http
      .post<ReassessmentRequest>(
        `${this.base}/ReassessmentRequests/${numericId(id)}/start`,
        { expectedVersion },
      )
      .pipe(timeout(30000));
  }
  completeReview(id: number, request: CompleteReassessment) {
    return this.http
      .post<ReassessmentRequest>(
        `${this.base}/ReassessmentRequests/${numericId(id)}/complete`,
        request,
      )
      .pipe(timeout(30000));
  }
  cancelReview(id: number, expectedVersion: number, reason: string) {
    return this.http
      .post<ReassessmentRequest>(
        `${this.base}/ReassessmentRequests/${numericId(id)}/cancel`,
        { expectedVersion, reason },
      )
      .pipe(timeout(30000));
  }
}
