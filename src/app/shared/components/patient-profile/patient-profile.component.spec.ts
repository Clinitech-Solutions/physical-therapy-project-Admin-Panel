import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController,provideHttpClientTesting } from '@angular/common/http/testing';
import { PatientProfileComponent } from './patient-profile.component';
import { PatientService } from '../../../core/services/patient.service';
import { ClinicalRecordsService } from '../../../core/services/clinical-records.service';
import { AppointmentService } from '../../../core/services/appointment.service';
import { BillingService } from '../../../core/services/billing.service';
import { Patient } from '../../../core/models/patient.model';

describe('Patient profile persisted record presentation',()=>{
  let component:PatientProfileComponent;let http:HttpTestingController;
  const patient:Patient={id:'1',nameEn:'Patient',nameAr:'Patient',avatar:'P',gender:'Male',phone:'010',paymentType:'Cash',lastVisit:'',documents:{medicalConsent:false,liabilityWaiver:false,idCard:false},documentsKnown:false};
  beforeEach(()=>{
    TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting()]});
    http=TestBed.inject(HttpTestingController);TestBed.inject(PatientService).patients.set([patient]);
    const clinical=TestBed.inject(ClinicalRecordsService);
    clinical.assessments.set([{id:1,patientId:1} as never]);
    clinical.plans.set([{id:5,assessmentId:1,doctorId:'doctor-guid',doctorName:'Doctor',numberOfSessions:10,completedSessions:2} as never]);
    clinical.sessions.set([{id:501,treatmentPlanId:5,sessionNumber:1,sessionDate:null,checkIn:null,checkOut:null,status:89} as never]);
    component=TestBed.runInInjectionContext(()=>new PatientProfileComponent());component.patientId='1';component.visible=true;
  });
  afterEach(()=>http.verify());
  it('resolves patients from backend cache without clinic-state fallbacks',()=>{expect(component.currentPatient?.id).toBe('1');});
  it('resolves clinician names and totals from saved treatment plans',()=>{expect(component.primaryDoctorName).toBe('Doctor');expect(component.totalSessions).toBe(10);});
  it('uses server completion counts rather than counting assumed session status numbers',()=>{expect(component.completedSessionsCount).toBe(2);expect(component.progressPercentage).toBe(20);});
  it('never fabricates missing sessions to fill a plan',()=>{expect(component.sessions.map(s=>s.id)).toEqual(['501']);});
  it('does not invent check-in or check-out timestamps',()=>{expect(component.formatTime(undefined)).toBeNull();expect(component.sessions[0].checkInTime).toBeUndefined();});
  it('keeps unknown invoice status unknown and links through the appointment ID',()=>{
    TestBed.inject(AppointmentService).appointments.set([{id:101,patientId:1,treatmentPlanSessionId:501} as never]);
    TestBed.inject(BillingService).invoices.set([{id:11,appointmentId:101,patientId:1,status:57} as never]);
    expect(component.getPaymentInfo('501')).toEqual({label:'Unknown',severity:'secondary'});
    expect(component.getPaymentInfo('999').label).toBe('Unknown');
  });
  it('emits close without mutating patient business data',()=>{
    const emit=vi.fn();component.visibleChange.subscribe(emit);component.closeModal();
    expect(emit).toHaveBeenCalledWith(false);expect(component.visible).toBe(false);expect(TestBed.inject(PatientService).patients()[0]).toEqual(patient);
  });
});
