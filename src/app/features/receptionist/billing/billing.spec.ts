import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { Injector, runInInjectionContext } from '@angular/core';
import { of } from 'rxjs';
import { BillingComponent } from './billing';
import { BillingService, Invoice } from '../../../core/services/billing.service';
import { PatientService } from '../../../core/services/patient.service';
import { AppointmentService } from '../../../core/services/appointment.service';
import { MessageService } from 'primeng/api';

describe('Receptionist BillingComponent & BillingService Suite', () => {
  let billing: BillingComponent;
  let billingService: BillingService;
  let messageService: MessageService;
  let toastMessages: any[] = [];
  const todayIso = new Date().toISOString();

  const initialInvoices: Invoice[] = [
    {
      id: 1001,
      appointmentId: 1,
      patientId: 1,
      type: 1, // Session
      totalAmount: 500,
      insuranceAmount: 0,
      patientAmount: 500,
      paidAmount: 0,
      remainingBalance: 500,
      status: 0, // Pending
      createdAt: todayIso
    },
    {
      id: 1002,
      appointmentId: 2,
      patientId: 2,
      type: 0, // Assessment
      totalAmount: 1000,
      insuranceAmount: 800,
      patientAmount: 200,
      paidAmount: 0,
      remainingBalance: 200,
      status: 0, // Pending
      createdAt: todayIso
    }
  ];

  beforeEach(() => {
    toastMessages = [];
    messageService = new MessageService();
    messageService.add = (msg: any) => {
      toastMessages.push(msg);
    };

    const injector = Injector.create({
      providers: [
        { provide: BillingService, useFactory: () => new BillingService(), deps: [] },
        { provide: PatientService, useValue: { patients: () => [], getPatients: () => of([]) } },
        { provide: AppointmentService, useValue: { appointments: () => [], getAppointments: () => {} } },
        { provide: MessageService, useValue: messageService }
      ]
    });

    billingService = injector.get(BillingService);
    billingService.invoices.set(
      initialInvoices.map((inv) => billingService.normalizeInvoice(inv))
    );

    // Mock recordPayment to update the target invoice in the signal
    billingService.recordPayment = (payload) => {
      const methodLabel = billingService.mapMethodToString(payload.method);
      billingService.invoices.update((list) =>
        list.map((inv) => {
          if (inv.id !== payload.invoiceId) return inv;
          const newPaid = (inv.paidAmount || 0) + payload.amount;
          const newRem = Math.max(0, inv.patientAmount - newPaid);
          return {
            ...inv,
            paidAmount: newPaid,
            remainingBalance: newRem,
            status: newRem <= 0 ? 'Paid' : 'Partial',
            paymentMethod: methodLabel
          };
        })
      );
      return of({
        id: 1,
        invoiceId: payload.invoiceId,
        amount: payload.amount,
        method: methodLabel
      });
    };

    billing = runInInjectionContext(injector, () => new BillingComponent());
  });

  it('should create BillingComponent and inject BillingService and MessageService', () => {
    expect(billing).toBeDefined();
    expect(billing.billingService).toBe(billingService);
    expect(billing.messageService).toBe(messageService);
  });

  describe('1. Reactive Computed Signal: invoices & Enum Mappings', () => {
    it('should reactively return all normalized invoices from BillingService', () => {
      const stateInvoices = billingService.invoices();
      expect(billing.invoices()).toEqual(stateInvoices);
      expect(billing.invoices().length).toBe(2);
      expect(billingService.mapTypeToString(1)).toBe('Session');
      expect(billingService.mapTypeToString(0)).toBe('Assessment');
      expect(billingService.mapStatusToString(0)).toBe('Pending');
      expect(billingService.mapStatusToString(1)).toBe('Paid');
    });

    it('should update reactively when a new invoice is added to BillingService', () => {
      const initialCount = billing.invoices().length;
      const newInv: Invoice = billingService.normalizeInvoice({
        id: 1099,
        appointmentId: 99,
        patientId: 3,
        type: 1,
        totalAmount: 800,
        insuranceAmount: 0,
        patientAmount: 800,
        status: 0,
        createdAt: todayIso
      });

      billingService.invoices.update((list) => [...list, newInv]);

      expect(billing.invoices().length).toBe(initialCount + 1);
      expect(billing.invoices().find((i) => i.id === 1099)).toBeDefined();
    });
  });

  describe('2. Payment Method Modal & Confirm Payment Workflow', () => {
    it('should open payment modal when openPaymentModal or payInvoice is called', () => {
      expect(billing.showPaymentModal).toBe(false);
      expect(billing.selectedInvoiceId).toBeNull();

      billing.payInvoice(1002);

      expect(billing.showPaymentModal).toBe(true);
      expect(billing.selectedInvoiceId).toBe(1002);
      expect(billing.amountToCollect).toBe(200); // patientAmount
      expect(billing.selectedPaymentMethod).toBe('Cash');
      expect(billing.paymentMethods).toEqual(['Cash', 'Credit Card', 'E-Wallet', 'InstaPay']);
    });

    it('should confirm payment with chosen payment method via BillingService.recordPayment, close modal, update status to Paid, and show toast', async () => {
      const pendingInvoice = billing
        .invoices()
        .find((i) => billingService.mapStatusToString(i.status) === 'Pending');
      expect(pendingInvoice).toBeDefined();

      const invoiceId = pendingInvoice!.id;

      billing.openPaymentModal(invoiceId);
      expect(billing.showPaymentModal).toBe(true);

      billing.selectedPaymentMethod = 'Credit Card';

      await billing.confirmPayment();

      expect(billing.showPaymentModal).toBe(false);
      expect(billing.selectedInvoiceId).toBeNull();

      const updatedInvoice = billingService.findInvoiceById(invoiceId);
      expect(billingService.mapStatusToString(updatedInvoice?.status)).toBe('Paid');
      expect(updatedInvoice?.paymentMethod).toBe('Credit Card');

      expect(toastMessages.length).toBeGreaterThan(0);
      const lastToast = toastMessages[toastMessages.length - 1];
      expect(lastToast.severity).toBe('success');
      expect(lastToast.detail).toEqual(expect.stringContaining('collected via Credit Card'));
    });
  });

  describe('3. Status Tag Severity Helper: getStatusSeverity', () => {
    it('should map Paid (or 1) to success (Green)', () => {
      expect(billing.getStatusSeverity('Paid')).toBe('success');
      expect(billing.getStatusSeverity(1)).toBe('success');
    });

    it('should map Pending (or 0) to warn (Orange/Warning)', () => {
      expect(billing.getStatusSeverity('Pending')).toBe('warn');
      expect(billing.getStatusSeverity(0)).toBe('warn');
    });

    it('should map Partial (or 2) to info (Blue)', () => {
      expect(billing.getStatusSeverity('Partial')).toBe('info');
      expect(billing.getStatusSeverity(2)).toBe('info');
    });

    it('should map Waived (or unknown status) to secondary', () => {
      expect(billing.getStatusSeverity('Waived')).toBe('secondary');
      expect(billing.getStatusSeverity('Unknown')).toBe('secondary');
    });
  });

  describe('4. Dynamic Revenue & KPI Computed Signals (totalAmount & patientAmount)', () => {
    it('should compute expectedTodayRevenue and pendingPaymentsTotal using totalAmount', () => {
      expect(billing.expectedTodayRevenue()).toBe(1500);
      expect(billing.pendingPaymentsTotal()).toBe(1500);
    });

    it('should compute collectedTodayRevenue and totalRevenue when invoice is Paid', async () => {
      billing.openPaymentModal(1001);
      await billing.confirmPayment();

      expect(billing.collectedTodayRevenue()).toBe(500);
      expect(billing.totalRevenue()).toBe(500);
      expect(billing.cashCollectedToday()).toBe(500);
    });

    it('should filter insuranceClaims where insuranceAmount > 0', () => {
      const claims = billing.insuranceClaims();
      expect(claims.length).toBe(1);
      expect(claims[0].id).toBe(1002);
      expect(claims[0].insuranceAmount).toBe(800);
    });
  });
});
