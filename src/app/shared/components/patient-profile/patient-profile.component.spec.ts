import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PatientProfileComponent } from './patient-profile.component';
import { ClinicStateService } from '../../../core/services/state/clinic-state.service';
import { TranslateModule } from '@ngx-translate/core';
import { Patient } from '../../../core/models/patient.model';

describe('PatientProfileComponent', () => {
  let component: PatientProfileComponent;
  let fixture: ComponentFixture<PatientProfileComponent>;
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
    await TestBed.configureTestingModule({
      imports: [
        PatientProfileComponent,
        TranslateModule.forRoot()
      ],
      providers: [ClinicStateService]
    }).compileComponents();

    fixture = TestBed.createComponent(PatientProfileComponent);
    component = fixture.componentInstance;
    clinicState = TestBed.inject(ClinicStateService);
    component.patient = mockTestPatient;
    component.visible = true;
    fixture.detectChanges();
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

  it('should display "Not Yet" for sessions without checkInTime or checkOutTime', () => {
    expect(component.formatTime(undefined)).toBe('Not Yet');
    expect(component.formatTime('')).toBe('Not Yet');
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
