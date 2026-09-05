import { Injectable, signal } from '@angular/core';
import { InsuranceClaim } from '../../models/insurance.model';
import { mockInsuranceClaims } from '../../mock-data/mock-db';

@Injectable({
  providedIn: 'root'
})
export class InsuranceService {
  private claimsSignal = signal<InsuranceClaim[]>([]);
  public claims = this.claimsSignal.asReadonly();
  public loading = signal<boolean>(false);
  public processing = signal<boolean>(false);

  constructor() {
    this.fetchClaims();
  }

  async fetchClaims() {
    this.loading.set(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    this.claimsSignal.set([...mockInsuranceClaims]);
    this.loading.set(false);
  }

  async submitClaim(id: string) {
    this.processing.set(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    this.claimsSignal.update(claims =>
      claims.map(c =>
        c.id === id
          ? { ...c, status: 'Submitted', missingDocs: [] }
          : c
      )
    );
    this.processing.set(false);
  }

  async saveCopay(id: string, copayAmount: number) {
    this.processing.set(true);
    await new Promise(resolve => setTimeout(resolve, 600));
    this.claimsSignal.update(claims =>
      claims.map(c =>
        c.id === id
          ? { ...c, copay: copayAmount, status: 'Approved' }
          : c
      )
    );
    this.processing.set(false);
  }
}
