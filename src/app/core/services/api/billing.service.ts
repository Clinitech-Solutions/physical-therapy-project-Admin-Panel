import { Injectable, signal } from '@angular/core';
import { Invoice } from '../../models/invoice.model';
import { mockInvoices } from '../../mock-data/mock-db';

@Injectable({
  providedIn: 'root'
})
export class BillingService {
  private invoicesSignal = signal<Invoice[]>([]);
  public invoices = this.invoicesSignal.asReadonly();
  public processingPayment = signal<boolean>(false);
  public loading = signal<boolean>(false);

  constructor() {
    this.fetchInvoices();
  }

  async fetchInvoices() {
    this.loading.set(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    this.invoicesSignal.set([...mockInvoices]);
    this.loading.set(false);
  }

  async processPayment(invoiceId: string) {
    this.processingPayment.set(true);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate payment processing delay
    this.invoicesSignal.update(invs =>
      invs.map(inv =>
        inv.id === invoiceId
          ? { ...inv, status: 'Paid' }
          : inv
      )
    );
    this.processingPayment.set(false);
  }
}
