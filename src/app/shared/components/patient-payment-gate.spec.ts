import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController,provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { PatientPaymentGateComponent } from './patient-payment-gate';
import { CourseFinanceService } from '../../core/services/course-finance.service';
import { environment } from '../../../environments/environment';

describe('Rendered patient payment shortfall',()=>{
 it('shows the server shortfall, collects exactly once on retry, and requires an explicit start',async()=>{
  TestBed.configureTestingModule({imports:[PatientPaymentGateComponent,TranslateModule.forRoot()],providers:[provideHttpClient(),provideHttpClientTesting(),provideNoopAnimations()]});
  const http=TestBed.inject(HttpTestingController);const finance=TestBed.inject(CourseFinanceService);const fixture=TestBed.createComponent(PatientPaymentGateComponent);
  finance.blockedAppointment.set(42);fixture.detectChanges();
  const blocked={appointmentId:42,canStart:false,accountKey:'course:1',invoiceId:1,pricingMode:'Package',patientPaid:1000,requiredCumulative:1500,additionalPaymentRequired:500,patientBalance:1000,consumedSessions:2};
  http.expectOne(`${environment.apiUrl}/Finance/appointments/42/payment-gate`).flush(blocked);await fixture.whenStable();
  expect(fixture.componentInstance.error()).toBe('');expect(fixture.componentInstance.gate()).toEqual(blocked);fixture.detectChanges();
  expect(fixture.nativeElement.textContent).toContain('500.00');expect(fixture.componentInstance.amount).toBe(500);
  const collecting=fixture.componentInstance.collect();const request=http.expectOne(`${environment.apiUrl}/Finance/appointments/42/payments`);
  const key=request.request.body.idempotencyKey;expect(request.request.body.amount).toBe(500);request.error(new ProgressEvent('error'));await collecting;
  const retry=fixture.componentInstance.collect();const repeated=http.expectOne(`${environment.apiUrl}/Finance/appointments/42/payments`);expect(repeated.request.body.idempotencyKey).toBe(key);
  repeated.flush({...blocked,canStart:true,additionalPaymentRequired:0,patientPaid:1500});await retry;await fixture.whenStable();
  http.expectNone(r=>r.url.endsWith('/status'));http.expectNone(r=>r.url.endsWith('/payment-gate'));
  const starting=fixture.componentInstance.start();http.expectOne(`${environment.apiUrl}/Receptionist/appointments/42/status`).flush(null);await starting;
  expect(finance.blockedAppointment()).toBeNull();fixture.destroy();http.verify();
 });
});
