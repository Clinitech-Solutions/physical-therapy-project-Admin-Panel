import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { map, finalize } from 'rxjs';
import { apiError, numericId, record, ReceptionError, textField } from './reception-api';

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
  private generation = 0;

  getCompanies(): void {
    const generation = ++this.generation;
    this.loading.set(true);
    this.error.set(null);
    this.http.get<unknown>(`${this.apiUrl}/GetAll`).pipe(map(value => {
      if (!Array.isArray(value)) throw new ReceptionError('RESPONSE_CONTRACT_PENDING', 'The insurer response needs verification.');
      return value.map(value => {
        const company = record(value);
        if (typeof company['isActive'] !== 'boolean') throw new ReceptionError('RESPONSE_CONTRACT_PENDING', 'The insurer response needs verification.');
        return { id: numericId(company['id']), name: textField(company['name']), isActive: company['isActive'],
          portalUrl: company['portalUrl'] == null ? null : textField(company['portalUrl']),
          hotline: company['hotline'] == null ? undefined : textField(company['hotline']),
          patients: Array.isArray(company['patients']) ? company['patients'] : undefined };
      });
    }), finalize(() => { if(generation === this.generation)this.loading.set(false); })).subscribe({
      next: (data) => {
        if (generation === this.generation) this.companies.set(data);
      },
      error: (err) => {
        if (generation === this.generation) this.error.set(apiError(err));
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
