import { Injectable, inject, signal } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { finalize, map, tap } from "rxjs";
import { environment } from "../../../environments/environment";
import {
  apiError,
  MutationState,
  numericId,
  record,
  ReceptionError,
  ReceptionEvents,
  textField,
} from "./reception-api";
import { pagedRecords } from "./reception-pagination";
import { backendEnumNumber } from './reception-contracts';

export interface Appointment {
  id?: number;
  assessmentCompleted?: boolean;
  actualCheckIn?: string | null;
  actualCheckOut?: string | null;
  patientId: number;
  doctorId?: string | null;
  seniorId?: string | null;
  roomId?: number | null;
  treatmentPlanSessionId?: number | null;
  appointmentType: string;
  startTime: string;
  endTime: string;
  status: number | string;
  patientName?: string;
  doctorName?: string;
  roomName?: string;
}
export interface AppointmentFilters {
  search?: string;
  doctorId?: string;
  roomId?: number;
  date?: string;
  status?: number;
  pageNumber?: number;
  pageSize?: number;
}
export interface AddAppointmentPayload {
  patientId: number;
  doctorId: string | null;
  seniorId?: string | null;
  roomId?: number | null;
  treatmentPlanSessionId?: number | null;
  appointmentType: string;
  startTime: string | Date;
  endTime: string | Date;
}
export interface UpdateAppointmentPayload {
  doctorId: string | null;
  seniorId?: string | null;
  roomId?: number | null;
  appointmentType: string;
  startTime: string | Date;
  endTime: string | Date;
  status: number;
}
export function decodeAppointment(value: unknown): Appointment {
  const r = record(value);
  const clinician = (v: unknown) => (v == null ? null : textField(v));
  if (typeof r["status"] !== "number" && typeof r["status"] !== "string")
    throw new ReceptionError(
      "APPOINTMENT_RESPONSE_PENDING",
      "A non-empty appointment response needs verification.",
    );
  return {
    id: numericId(r["id"]),
    assessmentCompleted: r['assessmentCompleted'] === true,
    actualCheckIn: typeof r['actualCheckIn'] === 'string' ? r['actualCheckIn'] : null,
    actualCheckOut: typeof r['actualCheckOut'] === 'string' ? r['actualCheckOut'] : null,
    patientId: numericId(r["patientId"]),
    doctorId: clinician(r["doctorId"]),
    seniorId: clinician(r["seniorId"]),
    roomId: r["roomId"] == null ? null : numericId(r["roomId"]),
    treatmentPlanSessionId:
      r["treatmentPlanSessionId"] == null
        ? null
        : numericId(r["treatmentPlanSessionId"]),
    appointmentType: textField(r["appointmentType"]),
    startTime: textField(r["startTime"]),
    endTime: textField(r["endTime"]),
    status: backendEnumNumber('appointmentStatus', r["status"]) as number | string,
    patientName:
      typeof r["patientName"] === "string" ? r["patientName"] : undefined,
    doctorName:
      typeof r["doctorName"] === "string" ? r["doctorName"] : undefined,
    roomName: typeof r["roomName"] === "string" ? r["roomName"] : undefined,
  };
}
@Injectable({ providedIn: "root" })
export class AppointmentService {
  private http = inject(HttpClient);
  private events = inject(ReceptionEvents);
  private apiUrl = `${environment.apiUrl}/Appointments`;
  readonly appointments = signal<Appointment[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly mutation = new MutationState();
  readonly bookedPlanSessions = signal<number[]>([]);
  private generation = 0;
  getAppointments(filters: AppointmentFilters = {}) {
    const generation = ++this.generation;
    this.loading.set(true);
    this.error.set(null);
    let params = new HttpParams();
    if (filters.search) params = params.set("Search", filters.search);
    if (filters.doctorId) params = params.set("DoctorId", filters.doctorId);
    if (filters.roomId)
      params = params.set("RoomId", numericId(filters.roomId));
    if (filters.date) params = params.set("Date", filters.date);
    if (filters.status !== undefined)
      params = params.set("Status", filters.status);
    pagedRecords(this.http, `${this.apiUrl}/GetAll`, decodeAppointment, params)
      .pipe(
        finalize(() => {
          if (generation === this.generation) this.loading.set(false);
        }),
      )
      .subscribe({
        next: (data) => {
          if (generation === this.generation) this.appointments.set(data);
        },
        error: (e) => {
          if (generation === this.generation) this.error.set(apiError(e));
        },
      });
  }
  getAppointment(id: number) {
    return this.http
      .get<unknown>(`${this.apiUrl}/${numericId(id)}`)
      .pipe(map(decodeAppointment));
  }
  private validate<T extends AddAppointmentPayload | UpdateAppointmentPayload>(
    payload: T,
  ): T {
    const start = new Date(payload.startTime),
      end = new Date(payload.endTime);
    if (
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime()) ||
      end <= start
    )
      throw new ReceptionError(
        "BOOKING_TIME_INVALID",
        "End time must be after a valid start time.",
      );
    if (
      payload.doctorId !== null &&
      (typeof payload.doctorId !== "string" || !payload.doctorId.trim())
    )
      throw new ReceptionError("CLINICIAN_REQUIRED", "Select a clinician.");
    if (!payload.doctorId && !payload.seniorId)
      throw new ReceptionError("CLINICIAN_REQUIRED", "Select a clinician.");
    if (payload.roomId != null) numericId(payload.roomId);
    if ("patientId" in payload) numericId(payload.patientId);
    return {
      ...payload,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    };
  }
  addAppointment(payload: AddAppointmentPayload) {
    return this.mutation
      .run(() => this.http.post<unknown>(this.apiUrl, this.validate(payload)))
      .pipe(
        tap(() => {
          if (payload.treatmentPlanSessionId != null)
            this.bookedPlanSessions.update((ids) => [
              ...new Set([...ids, payload.treatmentPlanSessionId!]),
            ]);
          this.events.changed.next("appointments");
        }),
      );
  }
  updateAppointment(id: number, payload: UpdateAppointmentPayload) {
    return this.mutation
      .run(() =>
        this.http.put<unknown>(
          `${this.apiUrl}/${numericId(id)}`,
          this.validate(payload),
        ),
      )
      .pipe(tap(() => this.events.changed.next("appointments")));
  }
  updateStatus(id: number, status: string) {
    return this.mutation
      .run(() =>
        this.http.patch<unknown>(
          `${this.apiUrl}/${numericId(id)}/status`,
          JSON.stringify(status),
          { headers: { "Content-Type": "application/json" } },
        ),
      )
      .pipe(tap(() => this.events.changed.next("appointments")));
  }
  deleteAppointment(id: number) {
    return this.mutation
      .run(() => this.http.delete<unknown>(`${this.apiUrl}/${numericId(id)}`))
      .pipe(tap(() => this.events.changed.next("appointments")));
  }
}
