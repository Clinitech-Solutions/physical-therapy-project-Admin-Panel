import { Injectable, inject, signal, computed } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { finalize, throwError } from "rxjs";
import { environment } from "../../../environments/environment";
import { apiError, finiteNumber, record } from "./reception-api";
import { ReceptionContracts } from "./reception-contracts";
import { pagedRecords } from "./reception-pagination";
import { decodeAppointment } from "./appointment.service";
import { AppointmentWorkflowService } from "./appointment-workflow.service";

export interface DashboardStats {
  todaysSessions: number;
  completedSessions: number;
  pendingPayments: number;
  todayRevenue: number;
  collectedTodayRevenue: number;
  expectedTodayRevenue: number;
  collectionRateToday: number;
  patientCollectedToday?: number;
  insurerCollectedToday?: number;
  presentDoctors?: number;
  walkInsToday?: number;
}
export interface TodaySession {
  id: number;
  appointmentId?: number;
  patientId: number;
  patientName?: string;
  doctorId?: string | null;
  doctorName?: string;
  seniorId?: string | null;
  roomId?: number | null;
  roomName?: string;
  appointmentType?: string;
  type?: string;
  startTime: string;
  endTime?: string;
  status: number | string;
  sessionNumber?: number;
  totalSessions?: number;
  packageAlert?: string;
}
export interface TodaySessionsFilters {
  search?: string;
  doctorId?: string;
  roomId?: number | string;
  pageNumber?: number;
  pageSize?: number;
}
@Injectable({ providedIn: "root" })
export class ReceptionistService {
  private http = inject(HttpClient, { optional: true });
  private contracts = inject(ReceptionContracts, { optional: true });
  private workflow = inject(AppointmentWorkflowService, { optional: true });
  readonly stats = signal<DashboardStats | null>(null);
  readonly todaySessions = signal<TodaySession[]>([]);
  readonly statsLoading = signal(false);
  readonly sessionsLoading = signal(false);
  readonly loading = computed(
    () => this.statsLoading() || this.sessionsLoading(),
  );
  readonly statsError = signal<string | null>(null);
  readonly sessionsError = signal<string | null>(null);
  readonly error = computed(() => this.statsError() || this.sessionsError());
  private generation = 0;
  private statsGeneration = 0;
  private lastFilters: TodaySessionsFilters = {};
  refreshTodaySessions() {
    this.getTodaySessions(this.lastFilters);
  }
  normalizeStats(value: unknown): DashboardStats {
    const r = record(value);
    return {
      todaysSessions: finiteNumber(r["todaysSessions"]),
      completedSessions: finiteNumber(r["completedSessions"]),
      pendingPayments: finiteNumber(r["pendingPayments"]),
      todayRevenue: finiteNumber(r["totalCollectedToday"]),
      collectedTodayRevenue: finiteNumber(r["totalCollectedToday"]),
      expectedTodayRevenue: finiteNumber(r["totalExpectedToday"]),
      collectionRateToday: finiteNumber(r["collectionRate"]),
      patientCollectedToday: r['patientCollectedToday']==null ? undefined : finiteNumber(r['patientCollectedToday']),
      insurerCollectedToday: r['insurerCollectedToday']==null ? undefined : finiteNumber(r['insurerCollectedToday']),
    };
  }
  normalizeSession(value: unknown): TodaySession {
    const a = decodeAppointment(value);
    return { ...a, id: a.id!, appointmentId: a.id, type: a.appointmentType };
  }
  mapStatusToNumber(status: number | string): number {
    if (!this.contracts)
      throw new Error("Backend status definitions are unavailable.");
    return this.contracts.value("appointmentStatus", status);
  }
  mapStatusToString(status: unknown): string {
    return (
      this.contracts?.label("appointmentStatus", status) ??
      (typeof status === "string" && !/^\\d+$/.test(status)
        ? status
        : "Unknown")
    );
  }
  getDashboardStats() {
    if (!this.http) {
      this.statsError.set("HTTP client unavailable.");
      return;
    }
    const generation = ++this.statsGeneration;
    this.statsLoading.set(true);
    this.statsError.set(null);
    this.http
      .get<unknown>(`${environment.apiUrl}/Receptionist/dashboard-stats`)
      .pipe(
        finalize(() => {
          if (generation === this.statsGeneration) this.statsLoading.set(false);
        }),
      )
      .subscribe({
        next: (value) => {
          if (generation !== this.statsGeneration) return;
          try {
            this.stats.set(this.normalizeStats(value));
          } catch (e) {
            this.statsError.set(apiError(e));
          }
        },
        error: (e) => {
          if (generation === this.statsGeneration)
            this.statsError.set(apiError(e));
        },
      });
  }
  getTodaySessions(filters: TodaySessionsFilters = {}) {
    if (!this.http) {
      this.sessionsError.set("HTTP client unavailable.");
      return;
    }
    this.lastFilters = { ...filters };
    const generation = ++this.generation;
    this.sessionsLoading.set(true);
    this.sessionsError.set(null);
    let params = new HttpParams();
    if (filters.search) params = params.set("Search", filters.search);
    if (filters.doctorId) params = params.set("DoctorId", filters.doctorId);
    if (filters.roomId) params = params.set("RoomId", String(filters.roomId));
    pagedRecords(
      this.http,
      `${environment.apiUrl}/Receptionist/today-sessions`,
      (value) => this.normalizeSession(value),
      params,
    )
      .pipe(
        finalize(() => {
          if (generation === this.generation) this.sessionsLoading.set(false);
        }),
      )
      .subscribe({
        next: (items) => {
          if (generation === this.generation) this.todaySessions.set(items);
        },
        error: (e) => {
          if (generation === this.generation)
            this.sessionsError.set(apiError(e));
        },
      });
  }
  updateSessionStatus(id: number, status: number) {
    if (!this.workflow || !this.contracts)
      return throwError(
        () => new Error("Backend status definitions are unavailable."),
      );
    const label = this.contracts.label("appointmentStatus", status);
    if (label !== "In Progress" && label !== "Completed")
      return throwError(() => new Error("Unsupported status transition."));
    return this.workflow.transition(id, label);
  }
  cancelSession(id: number) {
    return this.workflow
      ? this.workflow.cancel(id)
      : throwError(() => new Error("HTTP client unavailable."));
  }
}
