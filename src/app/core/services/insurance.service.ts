import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface InsuranceCompany {
  id?: number;
  name: string;
  portalUrl: string | null;
  isActive: boolean;
  hotline?: string;
  patients?: any[];
}

@Injectable({
  providedIn: 'root'
})
export class InsuranceService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/InsuranceCompanies`;

  companies = signal<InsuranceCompany[]>([]);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  getCompanies(): void {
    this.loading.set(true);
    this.error.set(null);
    this.http.get<InsuranceCompany[]>(`${this.apiUrl}/GetAll`).subscribe({
      next: (data) => {
        // Fallback for wrapped responses (e.g. data.value) if the API uses a standard envelope
        const result = (data as any).value !== undefined ? (data as any).value : data;
        this.companies.set(result);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to fetch insurance companies');
        this.loading.set(false);
      }
    });
  }

  addCompany(payload: Partial<InsuranceCompany>) {
    return this.http.post<InsuranceCompany>(`${this.apiUrl}/Add`, payload);
  }

  updateCompany(id: number, payload: Partial<InsuranceCompany>) {
    return this.http.put<InsuranceCompany>(`${this.apiUrl}/Update/${id}`, payload);
  }

  deleteCompany(id: number) {
    return this.http.delete<void>(`${this.apiUrl}/Delete/${id}`);
  }
}
