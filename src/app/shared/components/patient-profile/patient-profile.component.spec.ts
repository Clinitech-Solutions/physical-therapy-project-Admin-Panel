import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { Injector, runInInjectionContext } from '@angular/core';
import { PatientProfileComponent } from './patient-profile.component';
import { ClinicStateService } from '../../../core/services/state/clinic-state.service';
import { Patient } from '../../../core/models/patient.model';

describe('PatientProfileComponent Suite', () => {
  let component: PatientProfileComponent;
  let clinicState: ClinicStateService;

  const mockTestPatient: Patient = {
    id: '1',
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
        { provide: ClinicStateService, useValue: clinicState }
      ]
    });

    component = runInInjectionContext(injector, () => new PatientProfileComponent());
    component.patient = mockTestPatient;
    component.visible = true;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should correctly resolve primary doctor name and patient info', () => {
    expect(component.currentPatient?.nameEn).toBe('Ahmed Fathy');
    expect(component.primaryDoctorName).toBe('Dr. Omar');
    expect(component.totalSessions).toBe(10);
  });

  it('should calculate completed sessions and progress percentage', () => {
    // Ahmed Fathy has session 1 (Assessment - hist_1) and session 2 (7) completed in mock data
    expect(component.completedSessionsCount).toBe(2);
    expect(component.progressPercentage).toBe(20);
  });

  it('should list all 10 sessions in order', () => {
    const sessions = component.sessions;
    expect(sessions.length).toBe(10);
    expect(sessions[0].sessionNumber).toBe(1);
    expect(sessions[1].sessionNumber).toBe(2);
    expect(sessions[2].sessionNumber).toBe(3);
    expect(sessions[9].sessionNumber).toBe(10);
  });

  it('should return null for formatTime when checkInTime or checkOutTime is missing', () => {
    expect(component.formatTime(undefined)).toBeNull();
    expect(component.formatTime('')).toBeNull();
  });

  it('should dynamically calculate payment status using invoice status', () => {
    // Session 1 has invoice INV-H01 with status Paid
    const pay1 = component.getPaymentInfo('hist_1');
    expect(pay1.label).toBe('Paid');
    expect(pay1.severity).toBe('success');

    // Session 4 has no invoice yet -> Unbilled
    const pay4 = component.getPaymentInfo('p1_s4');
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
