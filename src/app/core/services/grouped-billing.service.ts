import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface BillingFilters {
  search?: string; funding?: string; companyIds?: number[]; from?: string; to?: string;
  dateBasis: string; patientStatus?: string; type?: string; pricingMode?: string; status?: string;
  appointmentStatus?: string; sessionStatus?: string; planId?: string; clinicianId?: string; method?: string; claimStatus?: string;
}
export interface BillingAmounts {
  agreed: number; patientLiability: number; patientReceipts: number; patientRemaining: number;
  collectedInPeriod: number; insurerPlanned: number; insurerEarned: number; claimsSubmitted: number;
  insurerReceipts: number; insurerEarnedOutstanding: number; receiptCount: number;
}
export interface BillingPatient {
  patientId: number; name: string; phone: string | null; funding: string; companies: string[];
  invoiceCount: number; amounts: BillingAmounts; patientStatus: string; fullySettled: boolean;
}
export interface BillingInvoice {
  id: number; reference: string; patientId: number; patientName: string; createdAt: string; deliveredAt: string | null;
  funding: string; companyId: number | null; company: string | null; pricingMode: string; planId: number | null;
  agreementId: number | null; sessionId: number | null; clinicianId: string | null; clinicianName: string | null;
  type: string; status: string; amounts: BillingAmounts; patientStatus: string; fullySettled: boolean;
  patientShare: number; insurerShare: number; collectionBlockedReason: string | null;
}
export interface BillingPage<T> {
  items: T[]; matchingPatients: number; matchingInvoices: number; page: number; pageSize: number;
  totals: BillingAmounts; dateBasis: string; timezone: string;
}
export interface BillingAllocation { accountKey: string; amount: number; remaining: number; hash: string; items: {invoiceId: number; reference: string; balance: number; amount: number}[]; }
export interface BillingOptions { companies: { id: string; name: string }[]; plans: { id: string; name: string }[]; clinicians: { id: string; name: string }[]; }
@Injectable({ providedIn: 'root' })
export class GroupedBillingService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/Billing`;
  params(filters: BillingFilters, page = 1, pageSize = 20) {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    for (const [key, value] of Object.entries(filters)) {
      if (Array.isArray(value)) for (const item of value) params = params.append(key, item);
      else if (value !== '' && value != null) params = params.set(key, value);
    }
    return params;
  }
  patients(filters: BillingFilters, page = 1) { return this.http.get<BillingPage<BillingPatient>>(`${this.url}/patients`, { params: this.params(filters, page) }); }
  invoices(patientId: number, filters: BillingFilters, page = 1) { return this.http.get<BillingPage<BillingInvoice>>(`${this.url}/patients/${patientId}/invoices`, { params: this.params(filters, page, 10) }); }
  context(id:number) { return this.http.get<BillingInvoice>(`${this.url}/invoices/${id}/context`); }
  allocation(key: string, amount: number) { return this.http.get<BillingAllocation>(`${this.url}/accounts/${encodeURIComponent(key)}/allocation`, {params:{amount}}); }
  options() { return this.http.get<BillingOptions>(`${this.url}/filter-options`); }
  export(filters: BillingFilters, kind: string) { return this.http.get(`${this.url}/export`, { params: this.params(filters).set('kind', kind), responseType: 'blob' }); }
}
