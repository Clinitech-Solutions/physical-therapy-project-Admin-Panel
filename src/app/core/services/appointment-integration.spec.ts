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
  it('uses verified transition definitions and cancellation contracts',async()=>{
    const workflow=TestBed.inject(AppointmentWorkflowService);
    const entering=firstValueFrom(workflow.transition(10,'In Progress'));
    const checkIn=http.expectOne(`${url}/Receptionist/appointments/10/status`);expect(checkIn.request.body).toBe(4);checkIn.flush(null);await entering;
    const cancel=firstValueFrom(workflow.cancel(10));const req=http.expectOne(`${url}/Receptionist/appointments/10/cancel`);
    expect(req.request.method).toBe('PUT');expect(req.request.body).toBeNull();req.flush(null);await cancel;
  });
  it('maps only the dashboard fields observed on the running API',()=>{
    const service=TestBed.inject(ReceptionistService);
    expect(service.normalizeStats({todaysSessions:0,completedSessions:0,pendingPayments:0,totalExpectedToday:100,totalCollectedToday:25,collectionRate:25})).toMatchObject({expectedTodayRevenue:100,collectedTodayRevenue:25,collectionRateToday:25});
    expect(()=>service.normalizeStats({todayRevenue:100})).toThrow();
  });
  it('recognizes verified appointment transitions from the sibling backend', () => {
    expect(TestBed.inject(ReceptionContracts).label('appointmentStatus', 4)).toBe('In Progress');
  });
});
