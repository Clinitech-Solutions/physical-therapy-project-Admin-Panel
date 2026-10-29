import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EMPTY, Observable, catchError, defer, expand, finalize, map, reduce, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NewPatient, Patient } from '../models/patient.model';
import { PagedPatientsResponse, PatientResponse } from '../models/patient-api.model';
import { createPatientRequest, updatePatientRequest, PatientOutcomeUnknownError, patientOutcomeIsUnknown } from './patient-registration';
import { ReceptionEvents, apiError, numericId } from './reception-api';

@Injectable({ providedIn: 'root' })
export class PatientService {
  private http = inject(HttpClient);
  private events = inject(ReceptionEvents);
  private apiUrl = `${environment.apiUrl}/Patients`;
  patients = signal<Patient[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly creating = signal(false);
  readonly creationOutcomeUnknown = signal(false);
  private readGeneration = 0;

  public mapToFrontendPatient(data: PatientResponse): Patient {
    const id = Number(data?.id);
    if (!Number.isSafeInteger(id) || id <= 0 || typeof data.fullName !== 'string' || typeof data.phoneNumber !== 'string') {
      throw new PatientOutcomeUnknownError();
    }
    const details = data.insuranceDetails;
    return {
      id: String(id), nameEn: data.fullName, nameAr: data.fullName,
      applicationUserId: data.applicationUserId, createdAt: data.createdAt,
      avatar: data.fullName?.split(/\s+/).map(n => n[0]).join('').slice(0, 2).toUpperCase() || '',
      phone: data.phoneNumber, birthDate: data.birthDate, email: data.email,
      emergencyContact: data.emergencyContact,
      gender: data.gender === 1 ? 'Female' : 'Male',
      paymentType: data.paymentType ?? null,
      // PatientResponse has neither lastVisit nor document checklist flags.
      lastVisit: '', documentsKnown: false, documents: { medicalConsent: false, liabilityWaiver: false, idCard: false },
      insuranceCompanyId: data.insuranceCompanyId == null ? null : Number(data.insuranceCompanyId),
      insuranceCompanyName: data.insuranceCompanyName,
      insuranceDetails: details ? {
        company: data.insuranceCompanyName ?? '', status: 'Unknown', apiStatus: details.status,
        copayPercentage: details.copayPercentage == null ? undefined : Number(details.copayPercentage),
        approvedSessions: details.approvedSessions == null ? undefined : Number(details.approvedSessions),
        memberId: details.memberId ?? undefined, employer: details.employer ?? undefined
      } : null
    };
  }

  /** Load every documented page so newly registered patients remain selectable after reload. */
  getPatients(): Observable<Patient[]> {
    const generation = ++this.readGeneration;
    this.loading.set(true); this.error.set(null);
    const page = (pageNumber: number) => this.http.get<PagedPatientsResponse>(`${this.apiUrl}/GetAll`, {
      params: { PageNumber: pageNumber, PageSize: 100 }
    });
    return page(1).pipe(
      expand(response => {
        if (!response.hasNextPage) return EMPTY;
        const current = Number(response.pageNumber);
        const total = Number(response.totalPages);
        if (!Number.isInteger(current) || current < 1 || !Number.isInteger(total) || current >= total) {
          throw new Error('Invalid patient pagination response.');
        }
        return page(current + 1);
      }),
      map(response => {
        if (!Array.isArray(response.items)) throw new Error('Invalid patient list response.');
        return response.items.map(item => this.mapToFrontendPatient(item));
      }),
      reduce((patients, items) => [...patients, ...items], [] as Patient[]),
      tap(patients => { if (generation === this.readGeneration) this.patients.set(patients); }),
      catchError(error => { if (generation === this.readGeneration) this.error.set(apiError(error)); return throwError(() => error); }),
      finalize(() => { if (generation === this.readGeneration) this.loading.set(false); })
    );
  }

  addPatient(draft: NewPatient): Observable<Patient> {
    return defer(() => {
      if (this.creating()) throw new Error('Patient registration is already in progress.');
      if (this.creationOutcomeUnknown()) throw new PatientOutcomeUnknownError();
      const payload = createPatientRequest(draft);
      this.creating.set(true);
      return this.http.post<PatientResponse>(`${this.apiUrl}/Add`, payload).pipe(
        map(response => this.mapToFrontendPatient(response)),
        tap(patient => { this.cachePatient(patient); this.events.changed.next('patients'); }),
        catchError(error => {
          if (patientOutcomeIsUnknown(error)) this.creationOutcomeUnknown.set(true);
          return throwError(() => error);
        }),
        finalize(() => this.creating.set(false))
      );
    });
  }

  private cachePatient(patient: Patient) {
    this.readGeneration++; this.loading.set(false);
    this.patients.update(patients => [patient, ...patients.filter(p => p.id !== patient.id)]);
  }

  getPatientById(id: number): Observable<Patient> {
    return this.http.get<PatientResponse>(`${this.apiUrl}/GetById/${numericId(id)}`).pipe(
      map(value => this.mapToFrontendPatient(value)), tap(patient => this.cachePatient(patient))
    );
  }

  updatePatient(id: number, patient: Partial<Patient>): Observable<Patient> {
    return defer(() => this.http.put<PatientResponse>(`${this.apiUrl}/Update/${numericId(id)}`, updatePatientRequest(patient))).pipe(
      map(response => this.mapToFrontendPatient(response)), tap(patient => { this.cachePatient(patient); this.events.changed.next('patients'); })
    );
  }

  deletePatient(id: number): Observable<unknown> {
    return this.http.delete(`${this.apiUrl}/Delete/${id}`).pipe(tap(() => this.events.changed.next('patients')));
  }
}
