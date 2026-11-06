import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { signal } from '@angular/core';
import { LiveDashboard } from './live-dashboard';
import { AuthService } from '../../../core/services/auth';
import { AppointmentService } from '../../../core/services/appointment.service';
import { environment } from '../../../../environments/environment';
const url=environment.apiUrl;
describe('Senior dashboard with persisted appointments',()=>{
  let fixture:ComponentFixture<LiveDashboard>;let http:HttpTestingController;
  beforeEach(async()=>{
    await TestBed.configureTestingModule({imports:[LiveDashboard,TranslateModule.forRoot()],providers:[provideHttpClient(),provideHttpClientTesting(),provideRouter([]),
      {provide:AuthService,useValue:{currentUser:signal({id:'senior',roles:['Senior']})}}]}).compileComponents();
    http=TestBed.inject(HttpTestingController);fixture=TestBed.createComponent(LiveDashboard);fixture.detectChanges();
    const appointment={id:101,patientId:1,patientName:'Patient',seniorId:'senior',doctorId:null,roomId:1,appointmentType:'Assessment',status:'Pending',startTime:new Date().toISOString(),endTime:new Date(Date.now()+3600000).toISOString()};
    http.expectOne(r=>r.url===`${url}/Bookings/assessments/tasks`).flush([appointment,{...appointment,id:102,seniorId:'another-senior'},{...appointment,id:103,status:'InProgress',assessmentCompleted:true}]);
    http.expectOne(`${url}/Bookings/clinicians/workload`).flush([{id:'doctor',name:'Doctor',gender:'Male',role:'Doctor',preferred:false,currentLoad:1}]);
    http.expectOne(`${url}/ReassessmentRequests`).flush([]);
    http.expectOne(r=>r.url===`${url}/Doctor/schedule`).flush({date:'2026-11-04',appointments:[],activeTreatments:[]});
    await fixture.whenStable();vi.spyOn(TestBed.inject(Router),'navigate').mockResolvedValue(true);
  });
  afterEach(()=>{fixture.destroy();http.verify();});
  it('shows only the assigned Senior unfinished clinical tasks and actual workload',()=>{
    expect(fixture.componentInstance.todayAssessments().map(t=>t.sessionId)).toEqual(['101']);
    expect(fixture.componentInstance.activeDoctorsWorkload()[0].currentLoad).toBe(1);
  });
  it('records explicit check-in before opening the assessment form',async()=>{
    const starting=fixture.componentInstance.startTask(fixture.componentInstance.todayAssessments()[0]);
    const request=http.expectOne(`${url}/Receptionist/appointments/101/status`);expect(request.request.body).toBe(4);expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();request.flush(null);await starting;
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/senior/assessment-form'],{queryParams:{patientId:'1',sessionId:'101'}});
  });
  it('keeps departed unsigned assessments from earlier clinic dates actionable without another check-in',async()=>{
    const appointments=TestBed.inject(AppointmentService);
    const earlier=new Date(Date.now()-3*86400000).toISOString();
    appointments.appointments.update(rows=>[...rows,{id:104,patientId:2,patientName:'Departed patient',seniorId:'senior',appointmentType:'Assessment',status:'Completed',assessmentCompleted:false,startTime:earlier,endTime:earlier,actualCheckIn:earlier,actualCheckOut:earlier}]);
    fixture.detectChanges();const task=fixture.componentInstance.todayAssessments().find(t=>t.sessionId==='104')!;
    expect(task.departed).toBe(true);expect(task.arrived).toBe(true);expect(fixture.nativeElement.querySelector('[data-assessment-task="104"]').textContent).toContain('SENIOR.DEPARTED_UNSIGNED');
    await fixture.componentInstance.startTask(task);http.expectNone(r=>r.url.includes('/status'));
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/senior/assessment-form'],{queryParams:{patientId:'2',sessionId:'104'}});
    appointments.appointments.update(rows=>rows.map(a=>a.id===104?{...a,assessmentCompleted:true}:a));expect(fixture.componentInstance.todayAssessments().some(t=>t.sessionId==='104')).toBe(false);
  });
  it('keeps a failed capacity refresh distinct from an empty clinician list',()=>{
    fixture.componentInstance.refreshCapacity();http.expectOne(`${url}/Bookings/clinicians/workload`).flush({}, {status:503,statusText:'Unavailable'});fixture.detectChanges();
    expect(fixture.componentInstance.capacityError()).toBeTruthy();expect(fixture.nativeElement.querySelector('.doctor-grid')).toBeNull();expect(fixture.nativeElement.textContent).not.toContain('SENIOR.NO_DOCTORS_AVAILABLE');
  });
});
