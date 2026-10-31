import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { AssessmentForm } from './assessment-form';
import { environment } from '../../../../environments/environment';
const url=environment.apiUrl;
describe('Persisted Senior assessment form',()=>{
  let fixture:ComponentFixture<AssessmentForm>;let http:HttpTestingController;
  beforeEach(async()=>{
    await TestBed.configureTestingModule({imports:[AssessmentForm,TranslateModule.forRoot()],providers:[provideHttpClient(),provideHttpClientTesting(),provideRouter([]),MessageService,
      {provide:ActivatedRoute,useValue:{queryParams:of({patientId:'1',sessionId:'10'})}}]}).compileComponents();
    http=TestBed.inject(HttpTestingController);fixture=TestBed.createComponent(AssessmentForm);fixture.detectChanges();
    http.expectOne(`${url}/Patients/GetById/1`).flush({id:1,fullName:'Patient',phoneNumber:'010',gender:'Male',paymentType:'Cash',birthDate:'2001-01-01T00:00:00Z'});
    http.expectOne(r=>r.url===`${url}/Bookings/patients/1/clinicians`&&r.params.get('treatment')==='true').flush([{id:'doctor',name:'Doctor',gender:'Male',role:'Doctor',preferred:false,currentLoad:0}]);
    await fixture.whenStable();
    vi.spyOn(TestBed.inject(Router),'navigate').mockResolvedValue(true);
    fixture.componentInstance.form.setValue({diagnosis:'Saved diagnosis',totalSessions:5,frequency:'Twice a week',assignedDoctorId:'doctor',exercises:'Exercises'});
  });
  afterEach(()=>{fixture.destroy();http.verify();});
  it('saves the assessment and plan through the backend before reporting success',async()=>{
    const saving=fixture.componentInstance.submit();const request=http.expectOne(`${url}/Bookings/assessments/complete`);
    expect(request.request.body).toMatchObject({appointmentId:10,diagnosis:'Saved diagnosis',numberOfSessions:5,frequencyPerWeek:2,doctorId:'doctor'});
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
    request.flush({id:5,doctorId:'doctor',plannedSessions:5});await saving;
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/senior/dashboard']);
    http.expectNone(r=>r.url.includes('/Billing/'));
  });
  it('keeps the form and error visible on a confirmed failure',async()=>{
    const saving=fixture.componentInstance.submit();http.expectOne(`${url}/Bookings/assessments/complete`).flush({detail:'Only the assigned Senior can complete this assessment.'},{status:403,statusText:'Forbidden'});await saving;
    expect(fixture.componentInstance.error()).toBeTruthy();expect(fixture.componentInstance.form.value.diagnosis).toBe('Saved diagnosis');
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
  });
  it('does not simulate successful completion for an unreadable response',async()=>{
    const saving=fixture.componentInstance.submit();http.expectOne(`${url}/Bookings/assessments/complete`).flush(null);await saving;
    expect(fixture.componentInstance.error()).toContain('verified');expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
  });
});
