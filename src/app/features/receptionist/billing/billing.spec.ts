import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { Injector, runInInjectionContext } from '@angular/core';
import { BillingComponent } from './billing';
import { ClinicStateService } from '../../../core/services/state/clinic-state.service';
import { MessageService } from 'primeng/api';
import { Invoice } from '../../../core/models/invoice.model';

describe('Receptionist BillingComponent Reactive Signals & Payment Suite', () => {
  let billing: BillingComponent;
  let clinicState: ClinicStateService;
  let messageService: MessageService;
  let toastMessages: any[] = [];

  beforeEach(async () => {
    clinicState = new ClinicStateService();
    messageService = new MessageService();
    toastMessages = [];
    messageService.add = (msg: any) => { toastMessages.push(msg); };

    // Wait for mock async initialization
    await new Promise(resolve => setTimeout(resolve, 600));

    const injector = Injector.create({
      providers: [
        { provide: ClinicStateService, useValue: clinicState },
        { provide: MessageService, useValue: messageService }
      ]
    });

    billing = runInInjectionContext(injector, () => new BillingComponent());
  });

  it('should create BillingComponent and inject ClinicStateService and MessageService', () => {
    expect(billing).toBeDefined();
    expect(billing.clinicState).toBe(clinicState);
    expect(billing.messageService).toBe(messageService);
  });

  describe('1. Reactive Computed Signal: invoices', () => {
    it('should reactively return all invoices from clinicState', () => {
      const stateInvoices = clinicState.invoices();
      expect(billing.invoices()).toEqual(stateInvoices);
      expect(billing.invoices().length).toBe(stateInvoices.length);
    });

    it('should update reactively when a new invoice is added to state', () => {
      const initialCount = billing.invoices().length;
      const newInv: Invoice = {
        id: 'INV-NEW-99',
        patientId: '3',
        amount: 800,
        currency: 'EGP',
        status: 'Pending',
        type: 'Session',
        createdAt: new Date().toISOString()
      };

      (clinicState as any).invoicesSig.update((list: Invoice[]) => [...list, newInv]);

      expect(billing.invoices().length).toBe(initialCount + 1);
      expect(billing.invoices().find(i => i.id === 'INV-NEW-99')).toBeDefined();
    });
  });

  describe('2. Process Payment Workflow: payInvoice(invoiceId)', () => {
    it('should call clinicState.processPayment, update invoice status to Paid, and show success toast', async () => {
      const pendingInvoice = billing.invoices().find(i => i.status === 'Pending');
      expect(pendingInvoice).toBeDefined();

      const invoiceId = pendingInvoice!.id;

      await billing.payInvoice(invoiceId);

      // Verify state was updated to Paid
      const updatedInvoice = clinicState.invoices().find(i => i.id === invoiceId);
      expect(updatedInvoice?.status).toBe('Paid');

      // Verify computed signal in component reflected the change
      const componentInvoice = billing.invoices().find(i => i.id === invoiceId);
      expect(componentInvoice?.status).toBe('Paid');

      // Verify success toast was displayed with exact expected text
      expect(toastMessages.length).toBeGreaterThan(0);
      const lastToast = toastMessages[toastMessages.length - 1];
      expect(lastToast.severity).toBe('success');
      expect(lastToast.detail).toBe('Payment processed successfully');
    });
  });

  describe('3. Status Tag Severity Helper: getStatusSeverity', () => {
    it('should map Paid to success (Green)', () => {
      expect(billing.getStatusSeverity('Paid')).toBe('success');
    });

    it('should map Pending to warn (Orange/Warning)', () => {
      expect(billing.getStatusSeverity('Pending')).toBe('warn');
    });

    it('should map Partial to info (Blue)', () => {
      expect(billing.getStatusSeverity('Partial')).toBe('info');
    });

    it('should map unknown status to secondary', () => {
      expect(billing.getStatusSeverity('Unknown')).toBe('secondary');
    });
  });

  describe('4. Dynamic Revenue & KPI Computed Signals', () => {
    it('should compute totalRevenue as sum of all Paid invoices', () => {
      const expectedRevenue = billing.invoices()
        .filter(i => i.status === 'Paid')
        .reduce((sum, i) => sum + i.amount, 0);

      expect(billing.totalRevenue()).toBe(expectedRevenue);
    });

    it('should compute pendingPaymentsTotal as sum of all Pending invoices', () => {
      const expectedPending = billing.invoices()
        .filter(i => i.status === 'Pending')
        .reduce((sum, i) => sum + i.amount, 0);

      expect(billing.pendingPaymentsTotal()).toBe(expectedPending);
    });
  });
});
