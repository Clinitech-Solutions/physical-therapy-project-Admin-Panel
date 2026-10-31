import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController,provideHttpClientTesting} from '@angular/common/http/testing';
import {firstValueFrom} from 'rxjs';
import {BookingService} from '../../core/services/booking.service';
import {CourseFinanceService} from '../../core/services/course-finance.service';
import {environment} from '../../../environments/environment';

// HTTP/component integration only; actual persistence is tested by ASP.NET/SQLite and Chrome.
// The obsolete mock-state scenarios charged insurance assessments and fabricated session/financial records.
describe('Reception financial API boundary (mocked HTTP)',()=>{
 let http:HttpTestingController,bookings:BookingService,finance:CourseFinanceService;
 const base=environment.apiUrl;
 beforeEach(()=>{sessionStorage.clear();TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting()]});http=TestBed.inject(HttpTestingController);bookings=TestBed.inject(BookingService);finance=TestBed.inject(CourseFinanceService);});
 afterEach(()=>{http.verify();sessionStorage.clear();});
 it('gets saved eligibility without creating local clinical or financial records',async()=>{
  const result=firstValueFrom(bookings.context(1));http.expectOne(base+'/Bookings/patients/1').flush({patientId:1,plans:[],hasCompletedAssessment:false,isInsurance:true});
  expect((await result).hasCompletedAssessment).toBe(false);http.expectNone(r=>r.method!=='GET');
 });
 it('preserves an unknown booking identity and rejects another intent until reconciliation',async()=>{
  const request={idempotencyKey:'original-booking'} as never;
  const attempt=firstValueFrom(bookings.create(request)).catch(e=>e);http.expectOne(base+'/Bookings').error(new ProgressEvent('error'));await attempt;
  await expect(firstValueFrom(bookings.create({idempotencyKey:'replacement'} as never))).rejects.toThrow('Reconcile');http.expectNone(base+'/Bookings');
 });
 it('does not start a session when recording a patient collection',async()=>{
  const result=firstValueFrom(finance.collect(1,'receipt',25,'Online'));
  http.expectOne(base+'/Finance/appointments/1/payments').flush({appointmentId:1,canStart:true,invoiceId:10,patientPaid:25,requiredCumulative:25,additionalPaymentRequired:0,patientBalance:75});await result;
  http.expectNone(r=>r.url.endsWith('/status'));
 });
});
