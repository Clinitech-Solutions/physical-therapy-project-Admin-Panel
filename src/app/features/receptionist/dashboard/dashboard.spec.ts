import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { Injector, runInInjectionContext, signal } from '@angular/core';
import { Dashboard } from './dashboard';
import { ClinicStateService } from '../../../core/services/state/clinic-state.service';
import { MessageService } from 'primeng/api';
import { LanguageService } from '../../../core/services/language';
import { Session, SessionStatus, SessionType } from '../../../core/models/session.model';
import { Invoice } from '../../../core/models/invoice.model';

describe('Receptionist DashboardComponent Reactive Signals Suite', () => {
  let dashboard: Dashboard;
  let clinicState: ClinicStateService;
  let messageService: MessageService;
  let mockLangService: any;

  beforeEach(async () => {
    clinicState = new ClinicStateService();
    messageService = new MessageService();
    mockLangService = {
      currentLang: signal('en'),
      toggleLanguage: () => {},
      initLang: () => {}
    };

    // Wait for mock async initialization in ClinicStateService
    await new Promise(resolve => setTimeout(resolve, 600));

    const injector = Injector.create({
      providers: [
        { provide: ClinicStateService, useValue: clinicState },
        { provide: MessageService, useValue: messageService },
        { provide: LanguageService, useValue: mockLangService }
      ]
    });

    dashboard = runInInjectionContext(injector, () => new Dashboard());
  });

  it('should initialize Dashboard component and inject ClinicStateService', () => {
    expect(dashboard).toBeDefined();
    expect(dashboard.clinicState).toBe(clinicState);
  });

  describe('1. Real-time KPI Computed Signals', () => {
    it('todaySessions: should filter sessions where scheduledAt date matches today', () => {
      const today = new Date().toISOString().split('T')[0];
      const todaySessions = dashboard.todaySessions();
      expect(todaySessions.length).toBeGreaterThan(0);
      
      // All returned sessions must match today
      todaySessions.forEach(s => {
        expect(s.scheduledAt.startsWith(today)).toBe(true);
      });
    });

    it('completedSessionsCount: should count todaySessions where status is Completed', () => {
      const today = new Date().toISOString().split('T')[0];
      const initialCompleted = dashboard.completedSessionsCount();
      
      // In mock data, session '7' is Completed today
      expect(initialCompleted).toBe(1);

      // Dynamically add another completed session today
      const newCompletedSession: Session = {
        id: 'test_comp_1',
        scheduledAt: `${today}T15:00:00`,
        patientId: '1',
        doctorId: 'doc_2',
        roomId: 'room_1',
        status: 'Completed' as SessionStatus,
        type: 'Session' as SessionType
      };

      (clinicState as any).sessionsSig.update((list: Session[]) => [...list, newCompletedSession]);

      // Computed signal reactively updates!
      expect(dashboard.completedSessionsCount()).toBe(initialCompleted + 1);
    });

    it('pendingPaymentsCount: should count clinicState.invoices() where status is Pending', async () => {
      const initialPending = dashboard.pendingPaymentsCount();
      expect(initialPending).toBeGreaterThanOrEqual(1);

      // Process payment for the pending invoice
      const pendingInvoice = clinicState.invoices().find(i => i.status === 'Pending');
      expect(pendingInvoice).toBeDefined();

      if (pendingInvoice) {
        await clinicState.processPayment(pendingInvoice.id);
        // Computed signal updates reactively
        expect(dashboard.pendingPaymentsCount()).toBe(initialPending - 1);
      }
    });

    it('todayRevenue: should sum amount of Paid invoices created today', () => {
      const today = new Date().toISOString().split('T')[0];
      const initialRevenue = dashboard.todayRevenue();
      
      // All mock invoices initially start as Pending, so initial revenue is 0
      expect(initialRevenue).toBe(0);

      // Add a paid invoice created today
      const newPaidInvoice: Invoice = {
        id: 'INV-TEST',
        patientId: '2',
        amount: 450,
        currency: 'EGP',
        status: 'Paid',
        type: 'Session',
        createdAt: `${today}T12:00:00Z`
      };

      (clinicState as any).invoicesSig.update((list: Invoice[]) => [...list, newPaidInvoice]);

      // Reactive computed signal updates immediately
      expect(dashboard.todayRevenue()).toBe(450);
    });
  });

  describe('2. Reactive Filtered Today Sessions', () => {
    it('filteredTodaySessions: should reactively filter by doctor and patient', () => {
      const allToday = dashboard.todaySessions();
      expect(dashboard.filteredTodaySessions().length).toBe(allToday.length);

      // Filter by doctor
      dashboard.filterDoctor.set('Hassan');
      const filteredByDoc = dashboard.filteredTodaySessions();
      filteredByDoc.forEach(s => {
        expect(clinicState.getDoctorName(s.doctorId).toLowerCase()).toContain('hassan');
      });

      // Clear doctor filter, filter by patient
      dashboard.filterDoctor.set('');
      dashboard.searchPatient.set('Ahmed');
      const filteredByPatient = dashboard.filteredTodaySessions();
      filteredByPatient.forEach(s => {
        expect(clinicState.getPatientName(s.patientId).toLowerCase()).toContain('ahmed');
      });
    });
  });
});
