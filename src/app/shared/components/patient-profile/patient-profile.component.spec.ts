/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController,provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { PatientProfileComponent } from './patient-profile.component';
import { PatientService } from '../../../core/services/patient.service';
import { ClinicalRecordsService } from '../../../core/services/clinical-records.service';
import { AppointmentService } from '../../../core/services/appointment.service';
import { BillingService } from '../../../core/services/billing.service';
import { Patient } from '../../../core/models/patient.model';
import { PatientResponse } from '../../../core/models/patient-api.model';
import { environment } from '../../../../environments/environment';

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

describe('Patient profile coverage and empty history', () => {
  let fixture: ComponentFixture<PatientProfileComponent>;
  let http: HttpTestingController;
  const url = environment.apiUrl;
  const response: PatientResponse = {
    id: 1, applicationUserId: 'patient-account', fullName: 'Self Paying Patient', email: 'patient@example.com',
    phoneNumber: '01012345678', gender: 0, birthDate: '2001-12-08T00:00:00Z', paymentType: 'Cash',
    emergencyContact: null, createdAt: '2026-10-29T11:00:00Z', insuranceCompanyId: 7,
    insuranceCompanyName: 'Stale insurer',
    insuranceDetails: { status: 1, copayPercentage: 20, approvedSessions: 10, memberId: 'old-member', employer: 'Old employer' }
  };
  const open = (paymentType = 'Cash') => {
    const patient = TestBed.inject(PatientService).mapToFrontendPatient({ ...response, paymentType });
    fixture.componentRef.setInput('patient', patient);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
  };
  const flushHistory = () => {
    http.expectOne(`${url}/Assessments/GetAll?patientId=1`).flush([]);
    http.expectOne(`${url}/TreatmentPlans/GetAll?patientId=1`).flush([]);
    http.expectNone(`${url}/TreatmentPlanSessions/GetAll`);
    http.expectOne(request => request.url.endsWith('/Appointments/GetAll'))
      .flush({ items: [], pageNumber: 1, totalPages: 1, hasNextPage: false });
    http.expectOne(`${url}/Billing/invoices`).flush([]);
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PatientProfileComponent, TranslateModule.forRoot()],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations()]
    }).compileComponents();
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', JSON.parse(readFileSync('public/assets/i18n/en.json', 'utf8')));
    translate.use('en');
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PatientProfileComponent);
  });
  afterEach(() => {
    try { fixture?.destroy(); http?.verify(); }
    finally { TestBed.resetTestingModule(); }
  });

  it('shows cash patients as self-paying with no insurance UI, document requests or empty-history errors', async () => {
    open();
    http.expectOne(`${url}/Patients/GetById/1`).flush(response);
    flushHistory();
    http.expectNone(`${url}/InsuranceDocuments`);
    await fixture.whenStable();
    const dialog = document.querySelector('.patient-profile-modal')!;
    expect(dialog.querySelector('[data-self-pay]')?.textContent).toContain('Self-paying patient');
    expect(dialog.querySelector('[data-patient-insurance]')).toBeNull();
    expect(dialog.querySelector('[data-insurance-documents]')).toBeNull();
    expect(dialog.querySelector('input[type="file"]')).toBeNull();
    expect(dialog.querySelector('[role="alert"]')).toBeNull();
    expect(dialog.textContent).toContain('Saved patient history');
    expect(dialog.textContent).not.toContain('Stale insurer');
    expect(dialog.textContent).not.toContain('Old employer');
    expect(dialog.textContent).toContain('patient@example.com');
    fixture.componentInstance.files = [new File(['document'], 'insurance.pdf')];
    await fixture.componentInstance.uploadDocuments();
    http.expectNone(request => request.method === 'POST');
  });

  it('uses fresh GetById coverage before fetching documents and retains the insurance workflow', async () => {
    open('Cash');
    http.expectNone(`${url}/InsuranceDocuments`);
    http.expectOne(`${url}/Patients/GetById/1`).flush({ ...response, paymentType: 'Insurance' });
    flushHistory();
    http.expectOne(r => r.url === `${url}/InsuranceDocuments` && r.params.get("patientId") === "1").flush([]);
    await fixture.whenStable();
    const dialog = document.querySelector('.patient-profile-modal')!;
    expect(dialog.querySelector('[data-patient-insurance]')).toBeTruthy();
    expect(dialog.querySelector('[data-insurance-documents]')).toBeTruthy();
    expect(dialog.querySelector('input[type="file"]')).toBeTruthy();
    expect(dialog.querySelector('[data-self-pay]')).toBeNull();
    expect(dialog.textContent).toContain('Stale insurer');
  });

  it('clears document errors and pending files when saved coverage changes to cash', async () => {
    open('Insurance');
    http.expectOne(`${url}/Patients/GetById/1`).flush({ ...response, paymentType: 'Insurance' });
    flushHistory();
    http.expectOne(r => r.url === `${url}/InsuranceDocuments` && r.params.get("patientId") === "1").flush({}, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();
    expect(fixture.componentInstance.documentsError()).toBeTruthy();
    fixture.componentInstance.files = [new File(['document'], 'insurance.pdf')];
    fixture.componentInstance.refreshProfile();
    http.expectOne(`${url}/Patients/GetById/1`).flush(response);
    flushHistory();
    http.expectNone(`${url}/InsuranceDocuments`);
    await fixture.whenStable();
    expect(fixture.componentInstance.documentsError()).toBe('');
    expect(fixture.componentInstance.files).toEqual([]);
    expect(document.querySelector('[data-insurance-documents]')).toBeNull();
    expect(document.querySelector('.patient-profile-modal [role="alert"]')).toBeNull();
  });

  it('continues to upload insurance documents for an insured patient', async () => {
    open('Insurance');
    http.expectOne(`${url}/Patients/GetById/1`).flush({ ...response, paymentType: 'Insurance' });
    flushHistory();
    http.expectOne(r => r.url === `${url}/InsuranceDocuments` && r.params.get("patientId") === "1").flush([]);
    await fixture.whenStable();
    fixture.componentInstance.files = [new File(['document'], 'insurance.pdf')];
    const upload = fixture.componentInstance.uploadDocuments();
    const request = http.expectOne(`${url}/InsuranceDocuments/Add`);
    expect(request.request.body.get('PatientId')).toBe('1');
    expect(request.request.body.getAll('Files')).toHaveLength(1);
    request.flush(null);
    await upload;
    http.expectOne(r => r.url === `${url}/InsuranceDocuments` && r.params.get("patientId") === "1").flush([]);
    expect(fixture.componentInstance.uploadSaved()).toBe(true);
  });

  it('renders verified patient documents with a protected download action', async () => {
    open('Insurance');
    http.expectOne(`${url}/Patients/GetById/1`).flush({ ...response, paymentType:'Insurance' });flushHistory();
    http.expectOne(r=>r.url===`${url}/InsuranceDocuments`&&r.params.get('patientId')==='1').flush([{id:7,patientId:1,fileName:'approval.pdf',contentType:'application/pdf',uploadedAt:'2030-01-01T10:00:00Z'}]);
    await fixture.whenStable();
    const section=document.querySelector('[data-insurance-documents]')!;
    expect(section.textContent).toContain('approval.pdf');expect(section.textContent).toContain('Download');
    expect(section.querySelector('a[href]')).toBeNull();expect(section.textContent).not.toContain('No insurance documents saved.');
  });

  it('does not present a failed document load as an empty result and retries only that section', async () => {
    open('Insurance');http.expectOne(`${url}/Patients/GetById/1`).flush({ ...response,paymentType:'Insurance' });flushHistory();
    http.expectOne(r=>r.url===`${url}/InsuranceDocuments`&&r.params.get('patientId')==='1').flush({}, {status:403,statusText:'Forbidden'});
    await fixture.whenStable();
    expect(document.querySelector('[data-insurance-documents]')?.textContent).not.toContain('No insurance documents saved.');
    fixture.componentInstance.retryDocuments();
    http.expectOne(r=>r.url===`${url}/InsuranceDocuments`&&r.params.get('patientId')==='1').flush([]);
    await fixture.whenStable();expect(fixture.componentInstance.documentsError()).toBe('');
    expect(document.querySelector('[data-insurance-documents]')?.textContent).toContain('No insurance documents saved.');
    http.expectNone(`${url}/Patients/GetById/1`);
  });

  it('labels genuine history failures while retaining the cash patient details', async () => {
    open();
    http.expectOne(`${url}/Patients/GetById/1`).flush(response);
    http.expectOne(`${url}/Assessments/GetAll?patientId=1`).flush({}, { status: 404, statusText: 'Not Found' });
    http.expectOne(`${url}/TreatmentPlans/GetAll?patientId=1`).flush([]);
    http.expectOne(request => request.url.endsWith('/Appointments/GetAll')).flush({ items: [], pageNumber: 1, totalPages: 1, hasNextPage: false });
    http.expectOne(`${url}/Billing/invoices`).flush([]);
    await fixture.whenStable();
    const dialog = document.querySelector('.patient-profile-modal')!;
    expect(dialog.querySelector('[role="alert"]')?.textContent).toContain('Could not load treatment history.');
    expect(dialog.textContent).toContain('patient@example.com');
    http.expectNone(`${url}/InsuranceDocuments`);
    http.expectNone(`${url}/TreatmentPlanSessions/GetAll`);
  });
});
