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
    http.expectOne(`${url}/Billing/invoices`).flush([]);
    http.expectOne(`${url}/Receptionist/dashboard-stats`).flush(stats);
    http.expectOne(r=>r.url.endsWith('/Receptionist/today-sessions')).flush(emptyPage);
  });
  it('does not turn a successful write into a failure when its refresh fails',async()=>{
    TestBed.inject(ReceptionRefreshService);
    const save=firstValueFrom(TestBed.inject(AppointmentWorkflowService).cancel(12));
    http.expectOne(`${url}/Receptionist/appointments/12/cancel`).flush(null);await expect(save).resolves.toBeNull();
    http.expectOne(r=>r.url.endsWith('/Appointments/GetAll')).flush({}, {status:500,statusText:'Error'});
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
    http.expectOne(`${url}/TreatmentPlans/GetAll`).flush([]);
    http.expectOne(`${url}/TreatmentPlanSessions/GetAll`).flush([]);
    expect(clinical.error()).toBeTruthy();expect(clinical.loading()).toBe(false);
  });
  it('updates an appointment while preserving its opaque numeric status and string clinician ID',async()=>{
    const component=TestBed.runInInjectionContext(()=>new ScheduleComponent());
    const source={id:12,patientId:1,doctorId:'doctor-guid',seniorId:null,roomId:2,appointmentType:'Session',startTime:'2026-11-01T09:00:00Z',endTime:'2026-11-01T10:00:00Z',status:73};
    const open=component.openEditAppointment(source);
    http.expectOne(`${url}/Appointments/12`).flush(source);await open;
    const save=component.saveAppointmentEdit();const req=http.expectOne(`${url}/Appointments/12`);
    expect(req.request.method).toBe('PUT');expect(req.request.body.status).toBe(73);expect(req.request.body.doctorId).toBe('doctor-guid');
    expect(req.request.body).not.toHaveProperty('patientId');req.flush(null);await save;
    http.expectOne(r=>r.url.endsWith('/Receptionist/today-sessions')).flush(emptyPage);
    expect(component.editingAppointment()).toBeNull();
  });
});
