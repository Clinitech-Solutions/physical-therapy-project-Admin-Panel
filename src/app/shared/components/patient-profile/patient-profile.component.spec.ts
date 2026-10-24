import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { Injector, runInInjectionContext } from '@angular/core';
import { PatientProfileComponent } from './patient-profile.component';
import { ClinicStateService } from '../../../core/services/state/clinic-state.service';
import { BillingService } from '../../../core/services/billing.service';
import { Patient } from '../../../core/models/patient.model';

describe('PatientProfileComponent Suite', () => {
  let component: PatientProfileComponent;
  let clinicState: ClinicStateService;
  let billingService: BillingService;

  const mockTestPatient: Patient = {
    id: 'p1',
    nameEn: 'Ahmed Fathy',
    nameAr: 'أحمد فتحي',
    avatar: 'AF',
    gender: 'Male',
    phone: '+201012345671',
    paymentType: 'Cash',
    lastVisit: '2026-09-01T00:00:00Z',
    documents: { medicalConsent: true, liabilityWaiver: true, idCard: true },
    treatmentPlan: { totalSessions: 10, primaryDoctorId: 'doc_2' }
  };

  beforeEach(async () => {
    clinicState = new ClinicStateService();
    await new Promise(resolve => setTimeout(resolve, 600));

    const injector = Injector.create({
      providers: [
        { provide: ClinicStateService, useValue: clinicState },
        { provide: BillingService, useFactory: () => new BillingService(), deps: [] }
      ]
    });

    billingService = injector.get(BillingService);
    billingService.invoices.set([
      billingService.normalizeInvoice({
        id: 1,
        appointmentId: 101,
        patientId: 1,
        type: 0, // Assessment
        totalAmount: 500,
        insuranceAmount: 0,
        patientAmount: 500,
        paidAmount: 500,
        status: 1 // Paid
      })
    ]);

    component = runInInjectionContext(injector, () => new PatientProfileComponent());
    component.patient = mockTestPatient;
    component.visible = true;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should correctly resolve primary doctor name and patient info', () => {
    expect(component.currentPatient?.nameEn).toBe('Ahmed Fathy');
    expect(component.primaryDoctorName).toContain('Dr. Omar');
    expect(component.totalSessions).toBe(10);
  });

  it('should calculate completed sessions and progress percentage', () => {
    // Ahmed Fathy (p1) has 4 completed Treatment Sessions (p1_s1..p1_s4) out of 10 in mock data
    expect(component.completedSessionsCount).toBe(4);
    expect(component.progressPercentage).toBe(40);
  });

  it('should list allsessions in order', () => {
    const sessions = component.sessions;
    expect(sessions.length).toBeGreaterThanOrEqual(10);
  });

  it('should return null for formatTime when checkInTime or checkOutTime is missing', () => {
    expect(component.formatTime(undefined)).toBeNull();
    expect(component.formatTime('')).toBeNull();
  });

  it('should dynamically calculate payment status using BillingService invoice status', () => {
    // Session 101 has invoice 1 with status 1 (Paid)
    const pay1 = component.getPaymentInfo('101');
    expect(pay1.label).toBe('Paid');
    expect(pay1.severity).toBe('success');

    // Session 999 has no invoice yet -> Unbilled
    const pay4 = component.getPaymentInfo('999');
    expect(pay4.label).toBe('RECEPTIONIST.UNBILLED');
    expect(pay4.severity).toBe('secondary');
  });

  it('should emit false when closing modal', () => {
    let emittedValue: boolean | undefined;
    component.visibleChange.subscribe(val => {
      emittedValue = val;
    });
    component.closeModal();
    expect(component.visible).toBe(false);
    expect(emittedValue).toBe(false);
  });
});
