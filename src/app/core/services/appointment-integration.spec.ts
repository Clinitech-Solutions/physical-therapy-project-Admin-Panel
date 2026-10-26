import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import { AppointmentService } from './appointment.service';
import { AppointmentWorkflowService } from './appointment-workflow.service';
import { ReceptionistService } from './receptionist.service';
import { ReceptionContracts, RECEPTION_ENUMS } from './reception-contracts';
import { RoomService } from './room.service';
import { ClinicianService } from './clinician.service';
import { ClinicalRecordsService } from './clinical-records.service';
import { PatientService } from './patient.service';
import { BillingService } from './billing.service';
import { BookingsComponent } from '../../features/receptionist/bookings/bookings';
import { environment } from '../../../environments/environment';

const url=environment.apiUrl;
const appointment={id:10,patientId:1,doctorId:'doctor-guid',seniorId:null,roomId:2,appointmentType:'Session',startTime:'2026-11-01T09:00:00Z',endTime:'2026-11-01T10:00:00Z',status:57};
const payload={patientId:1,doctorId:'doctor-guid',roomId:2,appointmentType:'Session',startTime:'2026-11-01T09:00:00Z',endTime:'2026-11-01T10:00:00Z'};
describe('Reception appointment integration',()=>{
  let http:HttpTestingController;
  beforeEach(()=>{
    TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting(),MessageService,
      {provide:RoomService,useValue:{rooms:signal([{id:2,name:'Room',capacity:1,isActive:true}])}},
      {provide:ClinicianService,useValue:{clinicians:signal([{id:'doctor-guid',name:'Doctor',roles:['Doctor']}])}},
      {provide:PatientService,useValue:{patients:signal([{id:'1',nameEn:'Patient',nameAr:'Patient',phone:'010',gender:'Male',paymentType:'Cash'}])}},
      {provide:BillingService,useValue:{getInvoices(){}}},
      {provide:ClinicalRecordsService,useValue:{load(){},plansForPatient:()=>[{id:5,doctorId:'doctor-guid'}],sessions:()=>[{id:20,treatmentPlanId:5,sessionNumber:1,sessionDate:null},{id:21,treatmentPlanId:5,sessionNumber:2,sessionDate:null}]}}
    ]});
    http=TestBed.inject(HttpTestingController);
  });
  afterEach(()=>http.verify());
  it('loads the observed paginated envelope and retains raw status and clinician GUID',()=>{
    const service=TestBed.inject(AppointmentService);service.getAppointments({doctorId:'doctor-guid'});
    const req=http.expectOne(r=>r.url.endsWith('/Appointments/GetAll')&&r.params.get('DoctorId')==='doctor-guid');
    req.flush({items:[appointment],pageNumber:1,totalPages:1,hasNextPage:false});
    expect(service.appointments()[0].doctorId).toBe('doctor-guid');
    expect(TestBed.inject(ReceptionContracts).label('appointmentStatus',57)).toBe('Unknown');
  });
  it('validates the complete interval before a POST',async()=>{
    const service=TestBed.inject(AppointmentService);
    await expect(firstValueFrom(service.addAppointment({...payload,endTime:payload.startTime}))).rejects.toThrow('End time');
    expect(service.mutation.busy()).toBe(false);http.expectNone(`${url}/Appointments`);
  });
  it('uses record PUT and status PATCH contracts without alternate paths',async()=>{
    const service=TestBed.inject(AppointmentService);
    const update=firstValueFrom(service.updateAppointment(10,{...payload,status:57}));
    const put=http.expectOne(`${url}/Appointments/10`);expect(put.request.method).toBe('PUT');expect(put.request.body.doctorId).toBe('doctor-guid');put.flush(null);await update;
    const patchResult=firstValueFrom(service.updateStatus(10,'Explicit server value'));
    const patch=http.expectOne(`${url}/Appointments/10/status`);expect(patch.request.body).toBe('"Explicit server value"');patch.flush(null);await patchResult;
  });
  it('blocks semantic transitions while enum definitions are unavailable, but allows cancellation',async()=>{
    const workflow=TestBed.inject(AppointmentWorkflowService);
    await expect(firstValueFrom(workflow.transition(10,'In Progress'))).rejects.toThrow('confirmed backend');
    expect(workflow.mutation.busy()).toBe(false);
    const cancel=firstValueFrom(workflow.cancel(10));const req=http.expectOne(`${url}/Receptionist/appointments/10/cancel`);
    expect(req.request.method).toBe('PUT');expect(req.request.body).toBeNull();req.flush(null);await cancel;
  });
  it('maps only the dashboard fields observed on the running API',()=>{
    const service=TestBed.inject(ReceptionistService);
    expect(service.normalizeStats({todaysSessions:0,completedSessions:0,pendingPayments:0,totalExpectedToday:100,totalCollectedToday:25,collectionRate:25})).toMatchObject({expectedTodayRevenue:100,collectedTodayRevenue:25,collectionRateToday:25});
    expect(()=>service.normalizeStats({todayRevenue:100})).toThrow();
  });
  function booking(){
    const component=TestBed.runInInjectionContext(()=>new BookingsComponent());
    component.selectedPatientId='1';component.selectedDoctorId='doctor-guid';component.selectedRoomId='2';return component;
  }
  it('does not create an invoice after successful appointment persistence',async()=>{
    const component=booking();component.scheduledDate=new Date(payload.startTime);component.scheduledEndDate=new Date(payload.endTime);
    const result=component.submitBooking();http.expectOne(`${url}/Appointments`).flush(null);await result;
    http.expectNone(`${url}/Billing/invoices`);
    http.expectOne(r=>r.url.endsWith('/Appointments/GetAll')).flush({items:[],totalPages:0,hasNextPage:false});
    expect(component.bookingError()).toBe('');
  });
  it('does not duplicate confirmed sessions when retrying a partially rejected recurring batch',async()=>{
    const component=booking();component.selectedPlanId=5;component.planSessionCount=2;component.planStartDate=new Date('2026-11-01T09:00:00');component.planPreferredTime=new Date('2026-11-01T09:00:00');component.planEndTime=new Date('2026-11-01T10:00:00');
    const first=component.submitTreatmentPlan();
    http.expectOne(`${url}/Appointments`).flush(null);await Promise.resolve();
    const second=http.expectOne(`${url}/Appointments`);expect(second.request.body.treatmentPlanSessionId).toBe(21);
    second.flush({title:'Room conflict'},{status:400,statusText:'Rejected'});await first;
    expect(component.bulkProgress()).toEqual([20]);expect(component.bookingError()).toContain('1 appointment(s) saved');
    const retry=component.submitTreatmentPlan();const req=http.expectOne(`${url}/Appointments`);expect(req.request.body.treatmentPlanSessionId).toBe(21);req.flush(null);await retry;
    http.expectOne(r=>r.url.endsWith('/Appointments/GetAll')).flush({items:[],totalPages:0,hasNextPage:false});
    expect(TestBed.inject(AppointmentService).bookedPlanSessions()).toEqual([20,21]);
  });
});
