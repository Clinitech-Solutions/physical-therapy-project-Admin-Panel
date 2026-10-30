import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { signal } from '@angular/core';
import { LiveDashboard } from './live-dashboard';
import { AuthService } from '../../../core/services/auth';
import { environment } from '../../../../environments/environment';
const url=environment.apiUrl;
describe('Senior dashboard with persisted appointments',()=>{
  let fixture:ComponentFixture<LiveDashboard>;let http:HttpTestingController;
  beforeEach(async()=>{
    await TestBed.configureTestingModule({imports:[LiveDashboard,TranslateModule.forRoot()],providers:[provideHttpClient(),provideHttpClientTesting(),provideRouter([]),
      {provide:AuthService,useValue:{currentUser:signal({id:'senior',roles:['Senior']})}}]}).compileComponents();
    http=TestBed.inject(HttpTestingController);fixture=TestBed.createComponent(LiveDashboard);fixture.detectChanges();
    const appointment={id:101,patientId:1,patientName:'Patient',seniorId:'senior',doctorId:null,roomId:1,appointmentType:'Assessment',status:'Pending',startTime:new Date().toISOString(),endTime:new Date(Date.now()+3600000).toISOString()};
    http.expectOne(r=>r.url===`${url}/Appointments/GetAll`).flush({items:[appointment,{...appointment,id:102,seniorId:'another-senior'},{...appointment,id:103,status:'InProgress',assessmentCompleted:true}],pageNumber:1,totalPages:1,hasNextPage:false});
    http.expectOne(`${url}/Bookings/clinicians/workload`).flush([{id:'doctor',name:'Doctor',gender:'Male',role:'Doctor',preferred:false,currentLoad:1}]);
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
});
