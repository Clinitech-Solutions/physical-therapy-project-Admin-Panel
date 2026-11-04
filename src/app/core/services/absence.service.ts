import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../../environments/environment";
import {
  AbsenceRequest,
  AbsenceView,
  AbsenceImpact,
  RecoveryBooking,
  RecoveryOptions,
  RecoveryRequest,
  RecoveryHistory,
} from "../models/absence.model";
import { timeout } from "rxjs";

@Injectable({ providedIn: "root" })
export class AbsenceService {
  private http = inject(HttpClient);
  private url = environment.apiUrl + "/Absences";
  list(date: string) {
    return this.http
      .get<AbsenceView[]>(this.url, { params: { date } })
      .pipe(timeout(20000));
  }
  affected() {
    return this.http
      .get<RecoveryBooking[]>(this.url + "/affected")
      .pipe(timeout(20000));
  }
  preview(request: AbsenceRequest) {
    return this.http
      .post<AbsenceImpact>(this.url + "/preview", request)
      .pipe(timeout(20000));
  }
  save(id: number | null, request: AbsenceRequest) {
    return (
      id === null
        ? this.http.post<AbsenceView>(this.url, request)
        : this.http.put<AbsenceView>(this.url + "/" + id, request)
    ).pipe(timeout(30000));
  }
  withdraw(id: number, request: AbsenceRequest) {
    return this.http
      .post<AbsenceView>(`${this.url}/${id}/withdraw`, request)
      .pipe(timeout(30000));
  }
  options(id: number, date?: string) {
    return this.http
      .get<RecoveryOptions>(`${this.url}/appointments/${id}/options`, {
        params: date ? { date } : {},
      })
      .pipe(timeout(20000));
  }
  resolve(id: number, request: RecoveryRequest) {
    return this.http
      .post<{
        appointmentId: number;
        operationKey: string;
        action: string;
        version: string;
      }>(`${this.url}/appointments/${id}/resolve`, request)
      .pipe(timeout(30000));
  }
  contact(
    row: RecoveryBooking,
    outcome: "Declined" | "AwaitingResponse",
    operationKey: string,
    reason: string,
  ) {
    return this.http
      .post(`${this.url}/appointments/${row.appointmentId}/contact`, {
        operationKey,
        expectedVersion: row.version,
        absenceId: row.absenceIds[0],
        outcome,
        reason,
      })
      .pipe(timeout(30000));
  }
  history(id: number) {
    return this.http
      .get<RecoveryHistory[]>(`${this.url}/appointments/${id}/history`)
      .pipe(timeout(20000));
  }
}
