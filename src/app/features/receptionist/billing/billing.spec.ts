import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { Injector, runInInjectionContext } from '@angular/core';
import { BillingComponent } from './billing';
import { ClinicStateService } from '../../../core/services/state/clinic-state.service';
import { MessageService } from 'primeng/api';
import { Invoice } from '../../../core/models/invoice.model';
import { SessionType } from '../../../core/models/session.model';

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

  describe('2. Payment Method Modal & Confirm Payment Workflow', () => {
    it('should open payment modal when openPaymentModal or payInvoice is called', () => {
      expect(billing.showPaymentModal).toBe(false);
      expect(billing.selectedInvoiceId).toBeNull();

      billing.payInvoice('INV-1002');

      expect(billing.showPaymentModal).toBe(true);
      expect(billing.selectedInvoiceId).toBe('INV-1002');
      expect(billing.selectedPaymentMethod).toBe('Cash');
      expect(billing.paymentMethods).toEqual(['Cash', 'Credit Card', 'E-Wallet']);
    });

    it('should confirm payment with chosen payment method, close modal, update status to Paid, and show toast', async () => {
      const pendingInvoice = billing.invoices().find(i => i.status === 'Pending');
      expect(pendingInvoice).toBeDefined();

      const invoiceId = pendingInvoice!.id;

      // Open modal
      billing.openPaymentModal(invoiceId);
      expect(billing.showPaymentModal).toBe(true);

      // Select 'Credit Card' method
      billing.selectedPaymentMethod = 'Credit Card';

      // Confirm payment
      await billing.confirmPayment();

      // Modal is closed
      expect(billing.showPaymentModal).toBe(false);
      expect(billing.selectedInvoiceId).toBeNull();

      // Verify invoice in state has status 'Paid' and paymentMethod 'Credit Card'
      const updatedInvoice = clinicState.invoices().find(i => i.id === invoiceId);
      expect(updatedInvoice?.status).toBe('Paid');
      expect(updatedInvoice?.paymentMethod).toBe('Credit Card');

      // Verify reactive signal in component updated
      const compInvoice = billing.invoices().find(i => i.id === invoiceId);
      expect(compInvoice?.status).toBe('Paid');

      // Verify success toast
      expect(toastMessages.length).toBeGreaterThan(0);
      const lastToast = toastMessages[toastMessages.length - 1];
      expect(lastToast.severity).toBe('success');
      expect(lastToast.detail).toBe('Payment processed successfully');
    });
  });

  describe('3. Auto-Invoice Generation on Booking (ClinicStateService)', () => {
    it('should automatically generate a new pending invoice when addSession is called for regular patient', async () => {
      const initialInvoiceCount = clinicState.invoices().length;
      const openRoom = clinicState.availableRooms()[0];

      // Patient 1 is Ahmed Fathy (Cash)
      await clinicState.addSession({
        patientId: '1',
        doctorId: 'doc_2',
        roomId: openRoom.id,
        scheduledAt: new Date().toISOString(),
        type: 'Session' as SessionType
      });

      expect(clinicState.invoices().length).toBe(initialInvoiceCount + 1);
      const latestInvoice = clinicState.invoices()[0];
      expect(latestInvoice.patientId).toBe('1');
      expect(latestInvoice.sessionId).toBeTruthy();
      expect(latestInvoice.status).toBe('Pending');
      expect(latestInvoice.amount).toBe(500); // Default amount
      expect(latestInvoice.currency).toBe('EGP');
      expect(latestInvoice.type).toBe('Session');
      expect(latestInvoice.id.startsWith('INV-')).toBe(true);
    });

    it('should automatically generate invoice with copay amount for insurance patient', async () => {
      const initialInvoiceCount = clinicState.invoices().length;
      const openRoom = clinicState.availableRooms()[0];

      // Patient 2 is Mona Zaki (Insurance, copayPercentage = 20, status = Approved)
      await clinicState.addSession({
        patientId: '2',
        doctorId: 'doc_1',
        roomId: openRoom.id,
        scheduledAt: new Date().toISOString(),
        type: 'Session' as SessionType
      });

      expect(clinicState.invoices().length).toBe(initialInvoiceCount + 1);
      const latestInvoice = clinicState.invoices()[0];
      expect(latestInvoice.patientId).toBe('2');
      expect(latestInvoice.sessionId).toBeTruthy();
      expect(latestInvoice.status).toBe('Pending');
      expect(latestInvoice.amount).toBe(20); // copayPercentage value
    });
  });

  describe('4. Status Tag Severity Helper: getStatusSeverity', () => {
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

  describe('5. Dynamic Revenue & KPI Computed Signals', () => {
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
