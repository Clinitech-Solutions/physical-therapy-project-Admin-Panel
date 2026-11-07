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
    expect(fixture.componentInstance.form.disabled).toBe(true);
    http.expectOne(`${url}/Patients/GetById/1`).flush({id:1,fullName:'Patient',phoneNumber:'010',gender:'Male',paymentType:'Cash',birthDate:'2001-01-01T00:00:00Z'});
    http.expectOne(r=>r.url===`${url}/Bookings/patients/1/clinicians`&&r.params.get('treatment')==='true').flush([{id:'doctor',name:'Doctor',gender:'Male',role:'Doctor',preferred:false,currentLoad:0}]);
    http.expectOne(`${url}/Bookings/assessments/appointments/10`).flush({appointmentId:10,patientId:1,startTime:'2026-11-01T10:00:00Z',arrivedAt:'2026-11-01T10:00:00Z',departedAt:'2026-11-01T11:00:00Z',completedAt:null,diagnosis:'Saved draft',notes:null,numberOfSessions:1,frequencyPerWeek:2,doctorId:null,exercises:null,treatmentType:'PhysicalTherapy'});
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
  it('shows physical departure separately from the saved unsigned assessment context',()=>{
    fixture.detectChanges();expect(fixture.nativeElement.querySelector('[data-departed-unsigned]')).not.toBeNull();
    expect(fixture.componentInstance.context()?.completedAt).toBeNull();expect(fixture.componentInstance.context()?.diagnosis).toBe('Saved draft');
    expect(fixture.componentInstance.context()?.departedAt).toBe('2026-11-01T11:00:00Z');
  });
  it('keeps the form and error visible on a confirmed failure',async()=>{
    const saving=fixture.componentInstance.submit();http.expectOne(`${url}/Bookings/assessments/complete`).flush({detail:'Only the assigned Senior can complete this assessment.'},{status:403,statusText:'Forbidden'});await saving;
    expect(fixture.componentInstance.error()).toBeTruthy();expect(fixture.componentInstance.form.value.diagnosis).toBe('Saved diagnosis');
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
  });
  it('warns and focuses the first invalid field without sending an incomplete signoff',async()=>{
    const warn=vi.spyOn(TestBed.inject(MessageService),'add');
    fixture.componentInstance.form.patchValue({diagnosis:'',totalSessions:0});fixture.detectChanges();
    await fixture.componentInstance.submit();fixture.detectChanges();
    expect(fixture.componentInstance.form.get('diagnosis')?.touched).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.objectContaining({severity:'warn'}));
    expect(document.activeElement?.id).toBe('assessment-diagnosis');
    expect(fixture.componentInstance.error()).toBeTruthy();http.expectNone(`${url}/Bookings/assessments/complete`);
  });
  it('keeps an incomplete draft and unsaved state after failure, then saves without signing or navigating',async()=>{
    const component=fixture.componentInstance;
    component.form.patchValue({totalSessions:0,frequency:'',assignedDoctorId:'',exercises:'Draft line one\nLine two'});
    component.form.markAsDirty();
    const failed=component.saveDraft();
    const attempt=http.expectOne(`${url}/Bookings/assessments/draft`);
    expect(attempt.request.body).toMatchObject({numberOfSessions:0,frequencyPerWeek:0,doctorId:''});
    attempt.flush({detail:'Temporary failure'},{status:503,statusText:'Unavailable'});await failed;
    expect(component.form.dirty).toBe(true);expect(component.form.value.exercises).toBe('Draft line one\nLine two');
    const retry=component.saveDraft();http.expectOne(`${url}/Bookings/assessments/draft`).flush({...component.context(),numberOfSessions:0,frequencyPerWeek:0,exercises:'Draft line one\nLine two'});await retry;
    expect(component.form.dirty).toBe(false);expect(component.context()?.completedAt).toBeNull();
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();http.expectNone(`${url}/Bookings/assessments/complete`);
  });
  it('does not simulate successful completion for an unreadable response',async()=>{
    const saving=fixture.componentInstance.submit();http.expectOne(`${url}/Bookings/assessments/complete`).flush(null);await saving;
    expect(fixture.componentInstance.error()).toBe('REQUEST_FAILED_SAFE');expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
  });
});
