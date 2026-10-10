import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Patient } from '../models/patient.model';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PatientService {
  private http = inject(HttpClient);
  
  private apiUrl = `${environment.apiUrl}/Patients`;

  // Keep the patients signal
  patients = signal<Patient[]>([]);

  // Helper method to prevent UI breakage
  public mapToFrontendPatient(apiData: any): Patient {
    const avatarStr = apiData.fullName 
      ? apiData.fullName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
      : 'NP';

    return {
      id: apiData.id ? apiData.id.toString() : Date.now().toString(),
      nameEn: apiData.fullName || 'New Patient',
      nameAr: apiData.fullName || 'مريض جديد',
      phone: apiData.phoneNumber || '',
      gender: apiData.gender === 1 ? 'Female' : 'Male',
      avatar: avatarStr || 'NP',
      paymentType: apiData.paymentType || 'Cash', // Fallback for UI
      lastVisit: new Date().toISOString(), // Safe fallback
      documents: {
        medicalConsent: false,
        liabilityWaiver: false,
        idCard: false
      },
      address: '',
      occupation: '',
      insuranceCompanyId: apiData.insuranceCompanyId || null,
      insuranceDetails: apiData.insuranceCompanyId ? {
        company: apiData.insuranceCompanyName || 'Unknown',
        status: 'Pending'
      } : undefined
    };
  }

  // Get patients and update the signal
  getPatients(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/GetAll`).pipe(
      tap((response) => {
        if (response && response.items) {
          const mappedData = response.items.map((item: any) => this.mapToFrontendPatient(item));
          this.patients.set(mappedData);
        }
      })
    );
  }

  private formatPayload(payload: any): any {
    const formatted: any = {
      userName: payload.nameEn || '',
      email: payload.email || '',
      fullName: payload.nameEn || '',
      gender: payload.gender === 'Female' ? 1 : 0,
      birthDate: payload.dob || null,
      phoneNumber: payload.phone || '',
      paymentType: payload.paymentType || 'Cash',
      emergencyContact: payload.emergencyContact || '',
      insuranceCompanyId: payload.insuranceCompanyId || null
    };

    if (payload.paymentType === 'Insurance' && payload.insuranceDetails) {
      formatted.insuranceDetails = {
        status: payload.insuranceDetails.status,
        copayPercentage: payload.insuranceDetails.copayPercentage || 0,
        approvedSessions: payload.insuranceDetails.approvedSessions || 0,
        memberId: payload.insuranceDetails.memberId || '',
        employer: payload.insuranceDetails.employer || ''
      };
    }
    
    return formatted;
  }

  // Add a new patient
  addPatient(payload: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/Add`, this.formatPayload(payload));
  }

  // Update an existing patient
  updatePatient(id: number, payload: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/Update/${id}`, this.formatPayload(payload));
  }

  // Delete a patient
  deletePatient(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/Delete/${id}`);
  }
}
