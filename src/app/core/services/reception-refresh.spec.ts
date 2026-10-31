import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController,provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom, throwError, TimeoutError } from 'rxjs';
import { ReceptionRefreshService } from './reception-refresh.service';
import { ReceptionEvents, MutationState } from './reception-api';
import { ReceptionistService } from './receptionist.service';
import { AppointmentWorkflowService } from './appointment-workflow.service';
import { ClinicalRecordsService } from './clinical-records.service';
import { PatientService } from './patient.service';
import { environment } from '../../../environments/environment';
import { MessageService } from 'primeng/api';
import { ScheduleComponent } from '../../features/receptionist/schedule/schedule';

const url=environment.apiUrl;
const emptyPage={items:[],totalPages:0,hasNextPage:false};
const stats={todaysSessions:0,completedSessions:0,pendingPayments:0,totalExpectedToday:0,totalCollectedToday:0,collectionRate:0};
describe('Reception refresh and concurrent reads',()=>{
  let http:HttpTestingController;
  beforeEach(()=>{TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting(),MessageService]});http=TestBed.inject(HttpTestingController);});
  afterEach(()=>http.verify());
  it('treats a client-side timeout as an unknown write outcome without replay',async()=>{
    const state=new MutationState();
    await expect(firstValueFrom(state.run(()=>throwError(()=>new TimeoutError())))).rejects.toBeInstanceOf(TimeoutError);
    expect(state.uncertain()).toBe(true);expect(state.busy()).toBe(false);
    await expect(firstValueFrom(state.run(()=>throwError(()=>new Error('must not execute'))))).rejects.toThrow('previous operation');
  });
  it('refreshes affected server records and statistics after a confirmed mutation',async()=>{
    TestBed.inject(ReceptionRefreshService);
    const save=firstValueFrom(TestBed.inject(AppointmentWorkflowService).cancel(12));
    http.expectOne(`${url}/Receptionist/appointments/12/cancel`).flush(null);await save;
    http.expectOne(r=>r.url.endsWith('/Appointments/GetAll')).flush(emptyPage);
    http.expectOne(`${url}/Rooms`).flush([]);
    http.expectOne(`${url}/Billing/invoices`).flush([]);
    http.expectOne(`${url}/Receptionist/dashboard-stats`).flush(stats);
    http.expectOne(r=>r.url.endsWith('/Receptionist/today-sessions')).flush(emptyPage);
  });
  it('does not turn a successful write into a failure when its refresh fails',async()=>{
    TestBed.inject(ReceptionRefreshService);
    const save=firstValueFrom(TestBed.inject(AppointmentWorkflowService).cancel(12));
    http.expectOne(`${url}/Receptionist/appointments/12/cancel`).flush(null);await expect(save).resolves.toBeNull();
    http.expectOne(r=>r.url.endsWith('/Appointments/GetAll')).flush({}, {status:500,statusText:'Error'});
    http.expectOne(`${url}/Rooms`).flush([]);
    http.expectOne(`${url}/Billing/invoices`).flush([]);
    http.expectOne(`${url}/Receptionist/dashboard-stats`).flush({}, {status:500,statusText:'Error'});
    http.expectOne(r=>r.url.endsWith('/Receptionist/today-sessions')).flush(emptyPage);
    expect(TestBed.inject(ReceptionistService).statsError()).toBeTruthy();
  });
  it('ignores an older dashboard response that arrives after a newer refresh',()=>{
    const reception=TestBed.inject(ReceptionistService);
    reception.getDashboardStats();const first=http.expectOne(`${url}/Receptionist/dashboard-stats`);
    reception.getDashboardStats();const second=http.expectOne(`${url}/Receptionist/dashboard-stats`);
    second.flush({...stats,todaysSessions:3});first.flush({...stats,todaysSessions:1});
    expect(reception.stats()?.todaysSessions).toBe(3);
  });
  it('does not replace a newly saved patient cache with an older in-flight list',async()=>{
    const patients=TestBed.inject(PatientService);
    const load=firstValueFrom(patients.getPatients());const older=http.expectOne(r=>r.url.endsWith('/Patients/GetAll'));
    const save=firstValueFrom(patients.addPatient({userName:'test.user',nameEn:'Test patient',nameAr:'',phone:'010',dob:'1990-01-01',gender:'Male',paymentType:'Cash',insuranceCompany:'',docs:{medicalConsent:false,liabilityWaiver:false,idCard:false}}));
    http.expectOne(`${url}/Patients/Add`).flush({id:7,fullName:'Test patient',phoneNumber:'010',birthDate:'1990-01-01T00:00:00Z',gender:0,insuranceDetails:null});await save;
    older.flush(emptyPage);await load;
    expect(patients.patients()[0].id).toBe('7');
  });
  it('keeps successful clinical sources while exposing an independent authorization failure',()=>{
    const clinical=TestBed.inject(ClinicalRecordsService);clinical.load(1);
    http.expectOne(`${url}/Assessments/GetAll?patientId=1`).flush({}, {status:403,statusText:'Forbidden'});
    http.expectOne(`${url}/TreatmentPlans/GetAll?patientId=1`).flush([]);
    http.expectNone(`${url}/TreatmentPlanSessions/GetAll`);
    expect(clinical.error()).toBeTruthy();expect(clinical.loading()).toBe(false);
  });
  it('treats a patient with no treatment plan as an empty history without requesting sessions',()=>{
    const clinical=TestBed.inject(ClinicalRecordsService);clinical.load(1);
    http.expectOne(`${url}/Assessments/GetAll?patientId=1`).flush([]);
    http.expectOne(`${url}/TreatmentPlans/GetAll?patientId=1`).flush([]);
    http.expectNone(`${url}/TreatmentPlanSessions/GetAll`);
    expect(clinical.sessions()).toEqual([]);expect(clinical.plansForPatient(1)).toEqual([]);
    expect(clinical.error()).toBeNull();expect(clinical.loading()).toBe(false);
  });
  it('loads sessions after finding a treatment plan and keeps real session failures visible',()=>{
    const clinical=TestBed.inject(ClinicalRecordsService);clinical.load(1);
    http.expectNone(`${url}/TreatmentPlanSessions/GetAll`);
    http.expectOne(`${url}/Assessments/GetAll?patientId=1`).flush([{id:1,patientId:1,seniorId:'senior-guid',status:0}]);
    http.expectOne(`${url}/TreatmentPlans/GetAll?patientId=1`).flush([{id:5,assessmentId:1,doctorId:'doctor-guid',numberOfSessions:10,completedSessions:0,progressPercentage:0,frequencyPerWeek:2,status:0}]);
    expect(clinical.loading()).toBe(true);
    http.expectOne(`${url}/TreatmentPlanSessions/GetAll?treatmentPlanId=5`).flush({title:'Not Found'}, {status:404,statusText:'Not Found'});
    expect(clinical.plansForPatient(1)[0].id).toBe(5);
    expect(clinical.error()).toBe('REQUEST_FAILED_SAFE');expect(clinical.loading()).toBe(false);
  });
  it('does not request sessions for a treatment plan belonging to another patient',()=>{
    const clinical=TestBed.inject(ClinicalRecordsService);clinical.load(1);
    http.expectOne(`${url}/Assessments/GetAll?patientId=1`).flush([]);
    http.expectOne(`${url}/TreatmentPlans/GetAll?patientId=1`).flush([{id:5,assessmentId:2,doctorId:'doctor-guid',numberOfSessions:10,completedSessions:0,progressPercentage:0,frequencyPerWeek:2,status:0}]);
    http.expectNone(`${url}/TreatmentPlanSessions/GetAll`);
    expect(clinical.error()).toBeNull();expect(clinical.loading()).toBe(false);
  });
  it('does not load sessions or replace history for an older patient refresh',()=>{
    const clinical=TestBed.inject(ClinicalRecordsService);clinical.load(1);
    const oldAssessments=http.expectOne(`${url}/Assessments/GetAll?patientId=1`);
    const oldPlans=http.expectOne(`${url}/TreatmentPlans/GetAll?patientId=1`);
    clinical.load(2);
    http.expectOne(`${url}/Assessments/GetAll?patientId=2`).flush([]);
    http.expectOne(`${url}/TreatmentPlans/GetAll?patientId=2`).flush([]);
    oldAssessments.flush([{id:1,patientId:1,seniorId:'senior-guid',status:0}]);
    oldPlans.flush([{id:5,assessmentId:1,doctorId:'doctor-guid',numberOfSessions:10,completedSessions:0,progressPercentage:0,frequencyPerWeek:2,status:0}]);
    http.expectNone(`${url}/TreatmentPlanSessions/GetAll`);
    expect(clinical.assessments()).toEqual([]);expect(clinical.plans()).toEqual([]);
    expect(clinical.loading()).toBe(false);
  });
  it('updates an appointment while preserving its pending status and string clinician ID',async()=>{
    const component=TestBed.runInInjectionContext(()=>new ScheduleComponent());
    const source={id:12,patientId:1,doctorId:'doctor-guid',seniorId:null,roomId:2,appointmentType:'Session',startTime:'2026-11-01T09:00:00Z',endTime:'2026-11-01T10:00:00Z',status:0};
    const open=component.openEditAppointment(source);
    http.expectOne(`${url}/Appointments/12`).flush(source);await open;
    const save=component.saveAppointmentEdit();const req=http.expectOne(`${url}/Appointments/12`);
    expect(req.request.method).toBe('PUT');expect(req.request.body.status).toBe(0);expect(req.request.body.doctorId).toBe('doctor-guid');
    expect(req.request.body).not.toHaveProperty('patientId');req.flush(null);await save;
    http.expectOne(r=>r.url.endsWith('/Receptionist/today-sessions')).flush(emptyPage);
    expect(component.editingAppointment()).toBeNull();
  });
});
