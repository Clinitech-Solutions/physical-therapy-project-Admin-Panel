import { ClinicalRecordsService } from './clinical-records.service';
import { AppointmentWorkflowService } from './appointment-workflow.service';
import { ReceptionContracts } from './reception-contracts';
import { RoomService } from './room.service';
import { ClinicianService } from './clinician.service';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient, HttpErrorResponse } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom, Subject } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { PatientRegistrationFieldsComponent } from '../../shared/components/patient-registration-fields/patient-registration-fields';
import { MessageService } from 'primeng/api';
import { PatientResponse } from '../models/patient-api.model';
import { environment } from '../../../environments/environment';
import { PatientService } from './patient.service';
import { BillingService } from './billing.service';
import { AppointmentService } from './appointment.service';
import { PatientsComponent } from '../../features/receptionist/patients/patients';
import { BookingsComponent } from '../../features/receptionist/bookings/bookings';
import { createPatientRequest, emptyPatientRegistration, patientBirthDate, patientEditDraft, patientEditChanges, PatientOutcomeUnknownError, patientServerError } from './patient-registration';

const base = environment.apiUrl;
const saved: PatientResponse = {
  id: 42, applicationUserId: 'user-guid', fullName: 'Test Patient', phoneNumber: '01012345678',
  email: '', birthDate: '1988-03-14T00:00:00Z', gender: 1, paymentType: 'Insurance',
  emergencyContact: '01123456789', insuranceCompanyId: 7, insuranceCompanyName: 'Server insurer',
  insuranceDetails: { status: 73, copayPercentage: '0', approvedSessions: '12', memberId: 'member-42', employer: 'Employer' },
  createdAt: '2026-10-26T10:00:00Z'
};
const draft = () => ({ ...emptyPatientRegistration(), userName: 'test.patient', nameEn: 'Test Patient',
  phone: '01012345678', dob: '1988-03-14', gender: 'Female' as const });
const page = (items: PatientResponse[], pageNumber = 1, hasNextPage = false) => ({ items, pageNumber, hasNextPage, totalPages: hasNextPage ? 2 : pageNumber });

describe('Patient registration contracts and safety', () => {
  let service: PatientService;
  let http: HttpTestingController;
  let messages: MessageService;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TranslateModule.forRoot(), PatientRegistrationFieldsComponent], providers: [provideHttpClient(), provideHttpClientTesting(), MessageService,
      { provide: ClinicalRecordsService, useValue: { load() {}, plansForPatient: () => [], sessions: () => [] } },
      { provide: AppointmentWorkflowService, useValue: {} },
      { provide: ReceptionContracts, useValue: {} },
      { provide: RoomService, useValue: { rooms: signal([]), refreshed: new Subject<void>() } },
      { provide: ClinicianService, useValue: { clinicians: signal([]), loading: signal(false), error: signal(null) } },
      { provide: BillingService, useValue: { getInvoices() {} } },
      { provide: AppointmentService, useValue: {} }
    ] });
    service = TestBed.inject(PatientService);
    http = TestBed.inject(HttpTestingController);
    messages = TestBed.inject(MessageService);
  });
  afterEach(() => http.verify());

  it('writes the selected insurance company into the exact draft that is submitted', async () => {
    const fixture = TestBed.createComponent(PatientRegistrationFieldsComponent);
    const insured = { ...draft(), paymentType: 'Insurance' as const };
    fixture.componentRef.setInput('draft', insured);
    fixture.componentRef.setInput('companies', [{ id: 7, name: 'Insurer', isActive: true, portalUrl: null }]);
    fixture.detectChanges();
    await fixture.whenStable();
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('select[required]');
    select.selectedIndex = 1;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(insured.insuranceCompanyId).toBe(7);
    expect(createPatientRequest(insured).insuranceCompanyId).toBe(7);
  });

  it('normalizes documented numeric insurer IDs for both registration selectors', () => {
    const component = TestBed.runInInjectionContext(() => new BookingsComponent());
    component.insuranceService.getCompanies();
    http.expectOne(`${base}/InsuranceCompanies/GetAll`).flush([{ id: '7', name: 'Insurer', isActive: true, portalUrl: null }]);
    expect(component.insuranceService.companies()[0].id).toBe(7);
  });

  it('maps only supported create fields and formats the actual birth date', () => {
    const request = createPatientRequest({ ...draft(), nameAr: 'Other name', address: 'Not in DTO' });
    expect(request).toEqual({ userName: 'test.patient', fullName: 'Test Patient', phoneNumber: '01012345678', gender: 1,
      birthDate: '1988-03-14T00:00:00.000Z', paymentType: 'Cash', emergencyContact: null, insuranceCompanyId: null, insuranceDetails: null });
  });

  it('registers cash patients without coverage and ignores stale insurance form values', () => {
    const request = createPatientRequest({ ...draft(), paymentType: 'Cash', insuranceCompanyId: 7,
      insuranceDetails: { company: 'Old insurer', status: 'Unknown', apiStatus: 1, copayPercentage: 20 } });
    expect(request).toMatchObject({ paymentType: 'Cash', insuranceCompanyId: null, insuranceDetails: null });
  });

  it('keeps insurance controls hidden and out of edits for a cash patient with stale coverage', () => {
    const component = TestBed.runInInjectionContext(() => new PatientsComponent());
    const cash = service.mapToFrontendPatient({ ...saved, paymentType: 'Cash' });
    component.loadedEditPatient.set(cash);
    component.editPatientForm = patientEditDraft(cash);
    expect(component.showExistingInsurance).toBe(false);
    component.editPatientForm.phone = '01111111111';
    component.editPatientForm.insuranceDetails!.copayPercentage = -1;
    expect(patientEditChanges(cash, component.editPatientForm)).toEqual({ phone: '01111111111' });
  });

  it.each(['', '2025-02-29', '2026-13-01', 'not-a-date'])('rejects invalid birth date %s', value => {
    expect(() => patientBirthDate(value)).toThrow('valid date of birth');
  });

  it.each([
    { userName: '' }, { userName: 'x'.repeat(51) }, { nameEn: ' ' }, { nameEn: 'x'.repeat(151) },
    { phone: '' }, { phone: '1'.repeat(21) }, { dob: '' }, { emergencyContact: '1'.repeat(21) }
  ])('rejects invalid required data before HTTP: %j', async fields => {
    await expect(firstValueFrom(service.addPatient({ ...draft(), ...fields }))).rejects.toThrow();
    expect(service.creating()).toBe(false);
    http.expectNone(`${base}/Patients/Add`);
  });

  it('binds insurance company ID and preserves zero values without inferring approval', () => {
    const request = createPatientRequest({ ...draft(), paymentType: 'Insurance', insuranceCompanyId: 7,
      insuranceDetails: { company: '', status: 'Unknown', copayPercentage: 0, approvedSessions: 0 } });
    expect(request.insuranceCompanyId).toBe(7);
    expect(request.insuranceDetails).toMatchObject({ status: null, copayPercentage: 0, approvedSessions: 0 });
  });

  it('rejects insurance registration without a company ID', () => {
    expect(() => createPatientRequest({ ...draft(), paymentType: 'Insurance' })).toThrow('insurance company');
  });

  it('normalizes returned fields and caches the real patient ID immediately', async () => {
    const result = firstValueFrom(service.addPatient(draft()));
    expect(service.patients()).toEqual([]);
    http.expectOne(`${base}/Patients/Add`).flush(saved);
    const patient = await result;
    expect(service.patients()).toEqual([patient]);
    expect(patient).toMatchObject({ id: '42', birthDate: saved.birthDate, lastVisit: '', emergencyContact: saved.emergencyContact,
      insuranceCompanyId: 7, insuranceDetails: { status: 'Unknown', apiStatus: 73, copayPercentage: 0, approvedSessions: 12, memberId: 'member-42', employer: 'Employer' } });
  });

  it('blocks overlapping submissions across both entry points', async () => {
    const first = firstValueFrom(service.addPatient(draft()));
    await expect(firstValueFrom(service.addPatient(draft()))).rejects.toThrow('already in progress');
    http.expectOne(`${base}/Patients/Add`).flush(saved);
    await first;
    expect(service.creating()).toBe(false);
  });

  it('never invents IDs or retries after an unrecognized success response', async () => {
    const result = firstValueFrom(service.addPatient(draft()));
    const rejected = expect(result).rejects.toBeInstanceOf(PatientOutcomeUnknownError);
    http.expectOne(`${base}/Patients/Add`).flush({ data: saved });
    await rejected;
    expect(service.patients()).toEqual([]);
    expect(service.creationOutcomeUnknown()).toBe(true);
    await expect(firstValueFrom(service.addPatient(draft()))).rejects.toBeInstanceOf(PatientOutcomeUnknownError);
  });

  it('blocks resubmission after a network failure with unknown persistence', async () => {
    const result = firstValueFrom(service.addPatient(draft()));
    const rejected = expect(result).rejects.toBeInstanceOf(HttpErrorResponse);
    http.expectOne(`${base}/Patients/Add`).error(new ProgressEvent('error'));
    await rejected;
    expect(service.creationOutcomeUnknown()).toBe(true);
    await expect(firstValueFrom(service.addPatient(draft()))).rejects.toBeInstanceOf(PatientOutcomeUnknownError);
  });

  it('shows ProblemDetails field errors and permits correction after rejection', async () => {
    const result = firstValueFrom(service.addPatient(draft())).catch(error => error);
    http.expectOne(`${base}/Patients/Add`).flush({ errors: { UserName: ['Username already exists.'], PhoneNumber: ['Invalid phone.'] } }, { status: 400, statusText: 'Bad Request' });
    expect(patientServerError(await result)).toContain('UserName: Username already exists.');
    expect(service.creating()).toBe(false);
    expect(service.creationOutcomeUnknown()).toBe(false);
  });

  it('reloads all pages and preserves birth date and insurance details', async () => {
    const result = firstValueFrom(service.getPatients());
    http.expectOne(r => r.url.endsWith('/Patients/GetAll') && r.params.get('PageNumber') === '1').flush(page([], 1, true));
    http.expectOne(r => r.url.endsWith('/Patients/GetAll') && r.params.get('PageNumber') === '2').flush(page([saved], 2));
    expect((await result)[0].birthDate).toBe(saved.birthDate);
    expect(service.patients()[0].insuranceDetails?.apiStatus).toBe(73);
  });

  it('updates a patient without replacing birth date or numeric insurance status with defaults', async () => {
    const patient = service.mapToFrontendPatient(saved);
    const result = firstValueFrom(service.updatePatient(42, patient));
    const request = http.expectOne(`${base}/Patients/Update/42`);
    expect(request.request.body.birthDate).toBe('1988-03-14T00:00:00.000Z');
    expect(request.request.body.insuranceDetails.status).toBe(73);
    expect(request.request.body).not.toHaveProperty('userName');
    request.flush(saved);
    await result;
  });

  it('keeps omitted update fields omitted', async () => {
    const result = firstValueFrom(service.updatePatient(42, { phone: '01111111111' }));
    const request = http.expectOne(`${base}/Patients/Update/42`);
    expect(request.request.body).toEqual({ phoneNumber: '01111111111' });
    request.flush(saved);
    await result;
  });

  it('loads every response field from GetById, including nullable payment and account metadata', async () => {
    const result = firstValueFrom(service.getPatientById(42));
    http.expectOne(`${base}/Patients/GetById/42`).flush({ ...saved, paymentType: null, insuranceCompanyId: null });
    expect(await result).toMatchObject({ applicationUserId: saved.applicationUserId, createdAt: saved.createdAt,
      paymentType: null, insuranceCompanyId: null, email: saved.email, emergencyContact: saved.emergencyContact });
  });

  it('updates email, explicit username and insurance fields independently of payment type', async () => {
    const result = firstValueFrom(service.updatePatient(42, { userName: '  changed.user  ', email: '  patient@example.com  ',
      insuranceCompanyId: 8, insuranceDetails: { company: '', status: 'Unknown', apiStatus: 1, copayPercentage: 0, approvedSessions: 0 } }));
    const request = http.expectOne(`${base}/Patients/Update/42`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ userName: 'changed.user', email: 'patient@example.com', insuranceCompanyId: 8,
      insuranceDetails: { status: 1, copayPercentage: 0, approvedSessions: 0, memberId: null, employer: null } });
    request.flush({ ...saved, email: 'patient@example.com' });
    expect((await result).email).toBe('patient@example.com');
  });

  it('sends explicit nulls when optional patient values are cleared', async () => {
    const result = firstValueFrom(service.updatePatient(42, { email: '', emergencyContact: '', paymentType: null,
      insuranceCompanyId: null, insuranceDetails: null }));
    const request = http.expectOne(`${base}/Patients/Update/42`);
    expect(request.request.body).toEqual({ email: '', emergencyContact: null, paymentType: null,
      insuranceCompanyId: null, insuranceDetails: null });
    request.flush({ ...saved, email: '', emergencyContact: null, paymentType: null, insuranceCompanyId: null, insuranceDetails: null });
    expect((await result).insuranceDetails).toBeNull();
  });

  it.each([
    { email: 'invalid-email' }, { userName: 'ab' }, { phone: '' }, { birthDate: '2025-02-29' },
    { insuranceDetails: { company: '', status: 'Unknown' as const, copayPercentage: 101 } },
    { insuranceDetails: { company: '', status: 'Unknown' as const, approvedSessions: -1 } },
    { insuranceDetails: { company: '', status: 'Unknown' as const, apiStatus: 1.5 } }
  ])('rejects invalid edits before HTTP: %j', async changes => {
    await expect(firstValueFrom(service.updatePatient(42, changes))).rejects.toThrow();
    http.expectNone(`${base}/Patients/Update/42`);
  });

  it('preserves nulls and undocumented enum values when an edit only changes the phone', () => {
    for (const paymentType of [null, 'Insurance', 'OtherPayment']) {
      for (const insuranceDetails of [null, saved.insuranceDetails]) {
        const patient = service.mapToFrontendPatient({ ...saved, paymentType, insuranceCompanyId: null, insuranceDetails });
        const form = patientEditDraft(patient);
        expect(patientEditChanges(patient, form)).toEqual({});
        form.phone = '01111111111';
        expect(patientEditChanges(patient, form)).toEqual({ phone: form.phone });
      }
    }
  });

  it('clears coverage when leaving insurance and requires a company when switching to insurance', async () => {
    const patient = service.mapToFrontendPatient(saved);
    const form = patientEditDraft(patient);
    form.paymentType = 'Cash';
    expect(patientEditChanges(patient, form)).toEqual({ paymentType: 'Cash', insuranceCompanyId: null, insuranceDetails: null });
    const cash = { ...patient, paymentType: 'Cash', insuranceCompanyId: null, insuranceDetails: null };
    const insured = { ...patientEditDraft(cash), paymentType: 'Insurance' };
    await expect(firstValueFrom(service.updatePatient(42, patientEditChanges(cash, insured)))).rejects.toThrow('insurance company');
    http.expectNone(`${base}/Patients/Update/42`);
  });

  it('fetches fresh detail before editing and never submits the stale list row', async () => {
    const component = TestBed.runInInjectionContext(() => new PatientsComponent());
    const stale = service.mapToFrontendPatient({ ...saved, fullName: 'Old list name', email: 'old@example.com' });
    const loading = component.editPatient(stale);
    expect(component.editLoading()).toBe(true);
    await component.updateProfile();
    http.expectNone(`${base}/Patients/Update/42`);
    http.expectOne(`${base}/Patients/GetById/42`).flush({ ...saved, email: 'current@example.com' });
    await loading;
    expect(component.editPatientForm).toMatchObject({ nameEn: saved.fullName, email: 'current@example.com',
      dob: '1988-03-14', emergencyContact: saved.emergencyContact, userName: '', insuranceDetails: { apiStatus: 73 } });
    component.editPatientForm.email = 'new@example.com';
    const updating = component.updateProfile();
    await component.updateProfile();
    const request = http.expectOne(`${base}/Patients/Update/42`);
    expect(request.request.body).toEqual({ email: 'new@example.com' });
    component.closeEditDrawer();
    expect(component.showEditDrawer()).toBe(true);
    request.flush({ ...saved, email: 'new@example.com' });
    await updating;
    expect(component.showEditDrawer()).toBe(false);
    expect(service.patients()[0].email).toBe('new@example.com');
    http.expectOne(r => r.url.endsWith('/Patients/GetAll')).flush(page([{ ...saved, email: 'new@example.com' }]));
  });

  it('keeps edit values and server validation visible after an update fails', async () => {
    const component = TestBed.runInInjectionContext(() => new PatientsComponent());
    const loading = component.editPatient(service.mapToFrontendPatient(saved));
    http.expectOne(`${base}/Patients/GetById/42`).flush(saved);
    await loading;
    component.editPatientForm.userName = 'duplicate.user';
    const updating = component.updateProfile();
    http.expectOne(`${base}/Patients/Update/42`).flush({ errors: { UserName: ['Username already exists.'] } },
      { status: 400, statusText: 'Bad Request' });
    await updating;
    expect(component.editError()).toBe('UserName: Username already exists.');
    expect(component.editPatientForm.userName).toBe('duplicate.user');
    expect(component.showEditDrawer()).toBe(true);
    expect(component.updating()).toBe(false);
  });

  it('blocks editing after a failed detail load and ignores late results after closing', async () => {
    const component = TestBed.runInInjectionContext(() => new PatientsComponent());
    const patient = service.mapToFrontendPatient(saved);
    const failed = component.editPatient(patient);
    http.expectOne(`${base}/Patients/GetById/42`).flush({}, { status: 404, statusText: 'Not Found' });
    await failed;
    expect(component.editError()).toContain('Could not load patient details');
    await component.updateProfile();
    http.expectNone(`${base}/Patients/Update/42`);
    const retry = component.editPatient(patient);
    component.closeEditDrawer();
    http.expectOne(`${base}/Patients/GetById/42`).flush(saved);
    await retry;
    expect(component.loadedEditPatient()).toBeNull();
    expect(component.showEditDrawer()).toBe(false);
  });

  it('selects a quick registration before refresh and distinguishes refresh failure', async () => {
    const component = TestBed.runInInjectionContext(() => new BookingsComponent());
    const add = vi.spyOn(messages, 'add');
    component.openQuickAddModal();
    component.quickPatient = draft();
    const result = component.saveQuickPatient();
    await component.saveQuickPatient(); // A second click must not POST.
    http.expectOne(`${base}/Patients/Add`).flush(saved);
    await result;
    expect(component.selectedPatientId).toBe('42');
    expect(component.selectedPatient?.birthDate).toBe(saved.birthDate);
    expect(component.isQuickAddModalOpen).toBe(false);
    http.expectOne(`${base}/Bookings/patients/42`).flush({ title: 'Eligibility unavailable' }, { status: 503, statusText: 'Unavailable' });
    http.expectOne(r => r.url.endsWith('/Bookings/patients')).flush({}, { status: 500, statusText: 'Error' });
    expect(service.patients()[0].id).toBe('42');
    expect(add.mock.calls.some(([message]) => message.severity === 'warn' && message.detail?.includes('Patient saved'))).toBe(true);
  });

  it('retries only documents after patient creation and keeps recovery on reopening', async () => {
    const component = TestBed.runInInjectionContext(() => new PatientsComponent());
    component.openDrawer();
    component.newPatient = { ...draft(), paymentType: 'Insurance', insuranceCompanyId: 7 };
    component.selectedFiles = [new File(['document'], 'insurance.pdf', { type: 'application/pdf' })];
    const result = component.createProfile();
    await component.createProfile();
    http.expectOne(`${base}/Patients/Add`).flush(saved);
    await Promise.resolve();
    http.expectOne(r => r.url.endsWith('/Patients/GetAll')).flush(page([saved]));
    const upload = http.expectOne(`${base}/InsuranceDocuments/Add`);
    expect(upload.request.body.get('PatientId')).toBe('42');
    upload.flush({}, { status: 400, statusText: 'Rejected' });
    await result;
    expect(component.createdPatient()?.id).toBe('42');
    expect(component.registrationError()).toContain('Patient #42 is saved');
    component.closeDrawer();
    component.openDrawer();
    expect(component.selectedFiles).toHaveLength(1);
    await component.createProfile();
    http.expectNone(`${base}/Patients/Add`);
    const retry = component.retryDocumentUpload();
    http.expectOne(`${base}/InsuranceDocuments/Add`).flush(null);
    await retry;
    expect(component.createdPatient()).toBeNull();
    expect(component.showDrawer()).toBe(false);
    component.openDrawer();
    expect(component.selectedFiles).toEqual([]);
  });
});
