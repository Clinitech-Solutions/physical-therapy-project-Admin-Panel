import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { Injector, runInInjectionContext, signal } from '@angular/core';
import { Dashboard } from './dashboard';
import { ClinicStateService } from '../../../core/services/state/clinic-state.service';
import { BillingService, Invoice } from '../../../core/services/billing.service';
import { MessageService } from 'primeng/api';
import { LanguageService } from '../../../core/services/language';
import { Session, SessionStatus, SessionType } from '../../../core/models/session.model';

describe('Receptionist DashboardComponent Reactive Signals Suite', () => {
  let dashboard: Dashboard;
  let clinicState: ClinicStateService;
  let billingService: BillingService;
  let messageService: MessageService;
  let mockLangService: any;
  const today = new Date().toISOString().split('T')[0];

  beforeEach(async () => {
    clinicState = new ClinicStateService();
    messageService = new MessageService();
    mockLangService = {
      currentLang: signal('en'),
      toggleLanguage: () => {},
      initLang: () => {}
    };

    await new Promise(resolve => setTimeout(resolve, 600));

    const injector = Injector.create({
      providers: [
        { provide: ClinicStateService, useValue: clinicState },
        { provide: BillingService, useFactory: () => new BillingService(), deps: [] },
        { provide: MessageService, useValue: messageService },
        { provide: LanguageService, useValue: mockLangService }
      ]
    });

    billingService = injector.get(BillingService);
    billingService.invoices.set([
      billingService.normalizeInvoice({
        id: 1,
        appointmentId: 101,
        patientId: 3,
        type: 1,
        totalAmount: 500,
        insuranceAmount: 0,
        patientAmount: 500,
        status: 0, // Pending
        createdAt: `${today}T10:00:00Z`
      })
    ]);

    dashboard = runInInjectionContext(injector, () => new Dashboard());
  });

  it('should initialize Dashboard component and inject BillingService and ClinicStateService', () => {
    expect(dashboard).toBeDefined();
    expect(dashboard.clinicState).toBe(clinicState);
    expect(dashboard.billingService).toBe(billingService);
  });

  describe('1. Real-time KPI Computed Signals (BillingService)', () => {
    it('todaySessions: should filter sessions where scheduledAt date matches today', () => {
      const todaySessions = dashboard.todaySessions();
      expect(todaySessions.length).toBeGreaterThan(0);

      todaySessions.forEach((s: any) => {
        const timeStr = s.startTime || s.scheduledAt;
        expect(timeStr?.startsWith(today)).toBe(true);
      });
    });

    it('completedSessionsCount: should count todaySessions where status is Completed', () => {
      const initialCompleted = dashboard.completedSessionsCount();

      const newCompletedSession: Session = {
        id: 'test_comp_1',
        scheduledAt: `${today}T15:00:00`,
        patientId: 'p1',
        doctorId: 'doc_2',
        roomId: 'room_1',
        status: 'Completed' as SessionStatus,
        type: 'Session' as SessionType
      };

      (clinicState as any).sessionsSig.update((list: Session[]) => [...list, newCompletedSession]);

      expect(dashboard.completedSessionsCount()).toBe(initialCompleted + 1);
    });

    it('pendingPaymentsCount: should count billingService.invoices() where status is Pending', () => {
      const initialPending = dashboard.pendingPaymentsCount();
      expect(initialPending).toBe(1);

      // Update invoice status to Paid (1)
      billingService.invoices.update((list) =>
        list.map((inv) => (inv.id === 1 ? billingService.normalizeInvoice({ ...inv, status: 1, paidAmount: 500 }) : inv))
      );

      expect(dashboard.pendingPaymentsCount()).toBe(0);
    });

    it('todayRevenue: should sum collected amount of Paid invoices created today from BillingService', () => {
      expect(dashboard.todayRevenue()).toBe(0);

      const newPaidInvoice: Invoice = billingService.normalizeInvoice({
        id: 2,
        appointmentId: 102,
        patientId: 2,
        type: 1,
        totalAmount: 450,
        insuranceAmount: 0,
        patientAmount: 450,
        paidAmount: 450,
        status: 1, // Paid
        createdAt: `${today}T12:00:00Z`
      });

      billingService.invoices.update((list) => [...list, newPaidInvoice]);

      expect(dashboard.todayRevenue()).toBe(450);
      expect(dashboard.collectedTodayRevenue()).toBe(450);
      expect(dashboard.expectedTodayRevenue()).toBe(950);
    });
  });

  describe('2. Reactive Filtered Today Sessions', () => {
    it('filteredTodaySessions: should reactively filter by doctor and patient', () => {
      const allToday = dashboard.todaySessions();
      expect(dashboard.filteredTodaySessions().length).toBe(allToday.length);

      dashboard.filterDoctor.set('Omar');
      const filteredByDoc = dashboard.filteredTodaySessions();
      filteredByDoc.forEach(s => {
        expect(clinicState.getDoctorName(s.doctorId?.toString()).toLowerCase()).toContain('omar');
      });

      dashboard.filterDoctor.set('');
      dashboard.searchPatient.set('Ahmed');
      const filteredByPatient = dashboard.filteredTodaySessions();
      filteredByPatient.forEach(s => {
        expect(clinicState.getPatientName(s.patientId?.toString()).toLowerCase()).toContain('ahmed');
      });
    });
  });
});
