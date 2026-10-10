import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { tap } from 'rxjs/operators';

export interface Appointment {
  id?: number;
  patientId: number;
  doctorId?: number | null;
  seniorId?: number | null;
  roomId?: number | null;
  treatmentPlanSessionId?: number | null;
  appointmentType: string;
  startTime: string; // ISO DateTime
  endTime: string;   // ISO DateTime
  status: number | string; // Assuming 1 means confirmed based on the payload, but keep flexible
  
  // Fallback UI properties for display later
  patientName?: string;
  doctorName?: string;
  roomName?: string;
}

export interface AppointmentFilters {
  search?: string;
  doctorId?: number;
  roomId?: number;
  date?: string;
  status?: string;
  pageNumber?: number;
  pageSize?: number;
}

export interface AddAppointmentPayload {
  patientId: number;
  doctorId: number;
  seniorId?: number;
  roomId?: number;
  treatmentPlanSessionId?: number;
  appointmentType: string;
  startTime: string | Date;
  endTime: string | Date;
}

export interface UpdateAppointmentPayload {
  doctorId: number;
  seniorId?: number;
  roomId?: number;
  appointmentType: string;
  startTime: string | Date;
  endTime: string | Date;
  status: string;
}

@Injectable({
  providedIn: 'root'
})
export class AppointmentService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/Appointments`;

  appointments = signal<Appointment[]>([]);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  getAppointments(filters: AppointmentFilters = {}): void {
    this.loading.set(true);
    this.error.set(null);

    let params = new HttpParams();
    if (filters.search) params = params.set('Search', filters.search);
    if (filters.doctorId) params = params.set('DoctorId', filters.doctorId.toString());
    if (filters.roomId) params = params.set('RoomId', filters.roomId.toString());
    if (filters.date) params = params.set('Date', filters.date);
    if (filters.status) params = params.set('Status', filters.status);
    if (filters.pageNumber) params = params.set('PageNumber', filters.pageNumber.toString());
    if (filters.pageSize) params = params.set('PageSize', filters.pageSize.toString());

    this.http.get<Appointment[]>(`${this.apiUrl}/GetAll`, { params }).subscribe({
      next: (data: any) => {
        // Fallback for wrapped responses (e.g. data.value or data.data)
        const result = data?.value !== undefined ? data.value : (data?.data !== undefined ? data.data : data);
        this.appointments.set(result || []);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to fetch appointments');
        this.loading.set(false);
      }
    });
  }

  addAppointment(payload: AddAppointmentPayload) {
    return this.http.post<Appointment>(`${this.apiUrl}/Add`, payload).pipe(
      tap(() => {
        this.getAppointments();
      })
    );
  }

  updateAppointment(id: number, payload: UpdateAppointmentPayload) {
    return this.http.put<Appointment>(`${this.apiUrl}/Update/${id}`, payload).pipe(
      tap(() => {
        this.getAppointments();
      })
    );
  }

  updateStatus(id: number, status: number | string) {
    // Sending the status as a JSON string to ensure proper model binding if API expects [FromBody] string
    return this.http.patch(`${this.apiUrl}/UpdateStatus/${id}/status`, JSON.stringify(status), {
      headers: { 'Content-Type': 'application/json' }
    }).pipe(
      tap(() => {
        this.appointments.update(apps =>
          apps.map(app => app.id === id ? { ...app, status } : app)
        );
      })
    );
  }

  deleteAppointment(id: number) {
    return this.http.delete<void>(`${this.apiUrl}/Delete/${id}`).pipe(
      tap(() => {
        this.appointments.update(apps => apps.filter(app => app.id !== id));
      })
    );
  }
}
