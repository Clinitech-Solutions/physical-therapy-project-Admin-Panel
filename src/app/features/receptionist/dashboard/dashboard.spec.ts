import { RoomService } from '../../../core/services/room.service';
import { ClinicianService } from '../../../core/services/clinician.service';
import { AppointmentWorkflowService } from '../../../core/services/appointment-workflow.service';
import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { Injector, runInInjectionContext, signal } from '@angular/core';
import { of } from 'rxjs';
import { Dashboard } from './dashboard';
import { ClinicStateService } from '../../../core/services/state/clinic-state.service';
import { ReceptionistService } from '../../../core/services/receptionist.service';
import { BillingService } from '../../../core/services/billing.service';
import { MessageService } from 'primeng/api';
import { LanguageService } from '../../../core/services/language';

describe('Receptionist DashboardComponent & ReceptionistService Suite', () => {
  let dashboard: Dashboard;
  let receptionistService: ReceptionistService;
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

    const injector = Injector.create({
      providers: [
        { provide: ClinicStateService, useValue: clinicState },
        { provide: RoomService, useValue: {rooms:signal([])} },
        { provide: ClinicianService, useValue: {clinicians:signal([])} },
        { provide: AppointmentWorkflowService, useValue: {mutation:{busy:()=>false},transition:vi.fn(()=>of(null)),cancel:vi.fn(()=>of(null))} },
        { provide: ReceptionistService, useFactory: () => new ReceptionistService(), deps: [] },
        { provide: BillingService, useFactory: () => new BillingService(), deps: [] },
        { provide: MessageService, useValue: messageService },
        { provide: LanguageService, useValue: mockLangService }
      ]
    });

    receptionistService = injector.get(ReceptionistService);
    billingService = injector.get(BillingService);

    receptionistService.stats.set(
      receptionistService.normalizeStats({
        todaysSessions: 5,
        completedSessions: 2,
        pendingPayments: 1,
        totalCollectedToday: 1200,
        totalExpectedToday: 2000,
        collectionRate: 60
      })
    );

    receptionistService.todaySessions.set([
      receptionistService.normalizeSession({
        id: 101,
        patientId: 1,
        patientName: 'Ahmed Fathy',
        doctorId: '2',
        doctorName: 'Dr. Omar',
        roomId: 1,
        roomName: 'Room 1',
        appointmentType: 'Session',
        startTime: `${today}T09:00:00`,
        endTime: new Date().toISOString(),
        status: 1 // Confirmed
      }),
      receptionistService.normalizeSession({
        id: 102,
        patientId: 2,
        patientName: 'Mona Zaki',
        doctorId: '1',
        doctorName: 'Dr. Sarah',
        roomId: 2,
        roomName: 'Room 2',
        appointmentType: 'Session',
        startTime: `${today}T10:00:00`,
        endTime: new Date().toISOString(),
        status: 2 // In Progress
      })
    ]);

    dashboard = runInInjectionContext(injector, () => new Dashboard());
  });

  it('should initialize Dashboard component and inject ReceptionistService', () => {
    expect(dashboard).toBeDefined();
    expect(dashboard.receptionistService).toBe(receptionistService);
    expect(dashboard.billingService).toBe(billingService);
  });

  describe('1. Real-time KPI Signals from ReceptionistService', () => {
    it('stats: should bind KPI stats directly from receptionistService.stats()', () => {
      const stats = dashboard.stats();
      expect(stats).toBeTruthy();
      expect(stats?.todaysSessions).toBe(5);
      expect(stats?.completedSessions).toBe(2);
      expect(stats?.pendingPayments).toBe(1);
      expect(stats?.collectedTodayRevenue).toBe(1200);
      expect(stats?.expectedTodayRevenue).toBe(2000);
      expect(stats?.collectionRateToday).toBe(60);
    });

    it('todaySessions: should return sessions from receptionistService.todaySessions()', () => {
      expect(dashboard.todaySessions().length).toBe(2);
      expect(dashboard.todaySessions()[0].patientName).toBe('Ahmed Fathy');
    });
  });

  describe('2. Session Actions (Check-In, Check-Out, Cancel)', () => {
    it('checkIn delegates to the shared workflow with a semantic status', async () => {
      await dashboard.checkIn(101);
      expect(dashboard.workflow.transition).toHaveBeenCalledWith(101,'In Progress');
    });
    it('checkOut delegates to the shared workflow', async () => {
      await dashboard.checkOut(102);
      expect(dashboard.workflow.transition).toHaveBeenCalledWith(102,'Completed');
    });
    it('cancelSession uses the shared cancellation operation', async () => {
      await dashboard.cancelSession(101);
      expect(dashboard.workflow.cancel).toHaveBeenCalledWith(101);
    });
  });

  describe('3. Reactive Filtered Today Sessions', () => {
    it('filteredTodaySessions: should reactively filter by doctor and patient', () => {
      expect(dashboard.filteredTodaySessions().length).toBe(2);

      dashboard.filterDoctor.set('Omar');
      expect(dashboard.filteredTodaySessions().length).toBe(1);
      expect(dashboard.filteredTodaySessions()[0].doctorName).toContain('Omar');

      dashboard.filterDoctor.set('');
      dashboard.searchPatient.set('Mona');
      expect(dashboard.filteredTodaySessions().length).toBe(1);
      expect(dashboard.filteredTodaySessions()[0].patientName).toContain('Mona');
    });
  });
});
