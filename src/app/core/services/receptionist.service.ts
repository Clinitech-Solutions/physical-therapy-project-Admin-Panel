import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface DashboardStats {
  todaysSessions: number;
  completedSessions: number;
  pendingPayments: number;
  todayRevenue: number;
  collectedTodayRevenue: number;
  expectedTodayRevenue: number;
  collectionRateToday: number;
  presentDoctors?: number;
  walkInsToday?: number;
}

export interface TodaySession {
  id: number;
  appointmentId?: number;
  patientId: number;
  patientName?: string;
  doctorId?: number | null;
  doctorName?: string;
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
  doctorId?: number | string;
  roomId?: number | string;
  pageNumber?: number;
  pageSize?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ReceptionistService {
  private http = inject(HttpClient, { optional: true });
  private apiUrl = `${environment.apiUrl}/Receptionist`;
  private lastFilters: TodaySessionsFilters = {};

  stats = signal<DashboardStats | null>(null);
  todaySessions = signal<TodaySession[]>([]);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  // Status Enum Mappings for Appointments
  // 0 = Pending, 1 = Confirmed, 2 = In Progress / Waiting, 3 = Completed, 4 = Cancelled
  mapStatusToNumber(status: number | string): number {
    if (typeof status === 'number') return status;
    switch (status) {
      case 'Pending':
      case 'Scheduled':
        return 0;
      case 'Confirmed':
        return 1;
      case 'In Progress':
      case 'InProgress':
      case 'Waiting':
        return 2;
      case 'Completed':
        return 3;
      case 'Cancelled':
        return 4;
      default:
        return 1;
    }
  }

  mapStatusToString(status: number | string | undefined): string {
    switch (status) {
      case 0:
      case '0':
      case 'Pending':
      case 'Scheduled':
        return 'Pending';
      case 1:
      case '1':
      case 'Confirmed':
        return 'Confirmed';
      case 2:
      case '2':
      case 'In Progress':
      case 'InProgress':
        return 'In Progress';
      case 'Waiting':
        return 'Waiting';
      case 3:
      case '3':
      case 'Completed':
        return 'Completed';
      case 4:
      case '4':
      case 'Cancelled':
        return 'Cancelled';
      default:
        return status !== undefined && status !== null ? String(status) : 'Confirmed';
    }
  }

  normalizeStats(raw: any): DashboardStats {
    const todaysSessions = Number(
      raw?.todaysSessions ??
        raw?.todaySessions ??
        raw?.totalTodaySessions ??
        raw?.totalSessionsToday ??
        0
    );
    const completedSessions = Number(
      raw?.completedSessions ?? raw?.completedTodaySessions ?? 0
    );
    const pendingPayments = Number(
      raw?.pendingPayments ?? raw?.pendingPaymentsCount ?? raw?.pendingInvoices ?? 0
    );
    const collectedTodayRevenue = Number(
      raw?.collectedTodayRevenue ??
        raw?.todayRevenue ??
        raw?.collectedRevenue ??
        raw?.totalRevenue ??
        0
    );
    const expectedTodayRevenue = Number(
      raw?.expectedTodayRevenue ??
        raw?.expectedRevenue ??
        raw?.todayRevenue ??
        collectedTodayRevenue
    );
    const explicitRate =
      raw?.collectionRateToday ?? raw?.collectionRate ?? undefined;
    const collectionRateToday =
      explicitRate !== undefined
        ? Number(explicitRate)
        : expectedTodayRevenue > 0
        ? Math.min(100, Math.round((collectedTodayRevenue / expectedTodayRevenue) * 100))
        : 0;

    return {
      ...raw,
      todaysSessions,
      completedSessions,
      pendingPayments,
      todayRevenue: collectedTodayRevenue,
      collectedTodayRevenue,
      expectedTodayRevenue,
      collectionRateToday,
      presentDoctors: Number(raw?.presentDoctors ?? 0),
      walkInsToday: Number(raw?.walkInsToday ?? 0)
    };
  }

  normalizeSession(raw: any): TodaySession {
    const id = Number(raw?.id ?? raw?.appointmentId ?? 0);
    return {
      ...raw,
      id,
      appointmentId: id,
      patientId: Number(raw?.patientId ?? 0),
      patientName: raw?.patientName ?? raw?.patientFullName,
      doctorId: raw?.doctorId ?? null,
      doctorName: raw?.doctorName ?? raw?.doctorFullName,
      roomId: raw?.roomId ?? null,
      roomName: raw?.roomName ?? raw?.roomDisplayName,
      appointmentType: raw?.appointmentType ?? raw?.type ?? 'Session',
      type: raw?.appointmentType ?? raw?.type ?? 'Session',
      startTime: raw?.startTime ?? raw?.scheduledAt ?? '',
      endTime: raw?.endTime ?? '',
      status: this.mapStatusToString(raw?.status)
    };
  }

  /**
   * 1. GET /api/Receptionist/dashboard-stats
   */
  getDashboardStats(): void {
    if (!this.http) return;
    this.loading.set(true);
    this.error.set(null);

    this.http.get<any>(`${this.apiUrl}/dashboard-stats`).subscribe({
      next: (data) => {
        const raw =
          data?.value !== undefined
            ? data.value
            : data?.data !== undefined
            ? data.data
            : data;
        this.stats.set(this.normalizeStats(raw));
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to fetch dashboard stats');
        this.loading.set(false);
      }
    });
  }

  /**
   * 2. GET /api/Receptionist/today-sessions
   * Query Params: Search, DoctorId, RoomId, PageNumber, PageSize
   */
  getTodaySessions(filters: TodaySessionsFilters = {}): void {
    if (!this.http) return;
    this.lastFilters = filters;
    this.loading.set(true);
    this.error.set(null);

    let params = new HttpParams();
    if (filters.search) params = params.set('Search', filters.search);
    if (filters.doctorId !== undefined && filters.doctorId !== '') {
      params = params.set('DoctorId', filters.doctorId.toString());
    }
    if (filters.roomId !== undefined && filters.roomId !== '') {
      params = params.set('RoomId', filters.roomId.toString());
    }
    if (filters.pageNumber) {
      params = params.set('PageNumber', filters.pageNumber.toString());
    }
    if (filters.pageSize) {
      params = params.set('PageSize', filters.pageSize.toString());
    }

    this.http
      .get<any>(`${this.apiUrl}/today-sessions`, { params })
      .subscribe({
        next: (data) => {
          const raw =
            data?.value !== undefined
              ? data.value
              : data?.data !== undefined
              ? data.data
              : data?.items !== undefined
              ? data.items
              : data;
          const items = Array.isArray(raw?.items)
            ? raw.items
            : Array.isArray(raw)
            ? raw
            : [];
          this.todaySessions.set(
            items.map((item: any) => this.normalizeSession(item))
          );
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err.message || 'Failed to fetch today sessions');
          this.loading.set(false);
        }
      });
  }

  /**
   * 3. PUT /api/Receptionist/appointments/{appointmentId}/status
   * Expects an integer in the body representing the new status.
   */
  updateSessionStatus(appointmentId: number, status: number): Observable<any> {
    if (!this.http) return of(null);
    return this.http
      .put(
        `${this.apiUrl}/appointments/${appointmentId}/status`,
        status,
        { headers: { 'Content-Type': 'application/json' } }
      )
      .pipe(
        tap(() => {
          this.getTodaySessions(this.lastFilters);
          this.getDashboardStats();
        })
      );
  }

  /**
   * 4. PUT /api/Receptionist/appointments/{appointmentId}/cancel
   * Cancels the appointment (no body required).
   */
  cancelSession(appointmentId: number): Observable<any> {
    if (!this.http) return of(null);
    return this.http
      .put(`${this.apiUrl}/appointments/${appointmentId}/cancel`, null)
      .pipe(
        tap(() => {
          this.getTodaySessions(this.lastFilters);
          this.getDashboardStats();
        })
      );
  }
}

