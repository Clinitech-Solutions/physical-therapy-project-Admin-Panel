import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { CourseFinanceService } from './course-finance.service';
import { AppointmentWorkflowService } from './appointment-workflow.service';
import { BookingService } from './booking.service';
import { BillingService } from './billing.service';
import { environment } from '../../../environments/environment';

const url = environment.apiUrl;
describe('Course finance API and recovery', () => {
 let api: CourseFinanceService; let http: HttpTestingController;
 beforeEach(() => { sessionStorage.clear(); TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting()]}); api=TestBed.inject(CourseFinanceService);http=TestBed.inject(HttpTestingController); });
 afterEach(() => { http.verify();sessionStorage.clear(); });
 it.each(['problem', 'legacy'])('opens the direct collection flow for %s check-in errors', async shape => {
   const start=firstValueFrom(TestBed.inject(AppointmentWorkflowService).transition(42,'In Progress')).catch(e=>e);
   http.expectOne(`${url}/Receptionist/appointments/42/status`).flush(shape === 'problem' ? {title:'Booking.PaymentCoverageRequired',detail:'Additional patient payment required: EGP 500.00.'} : {code:'Booking.PaymentCoverageRequired',description:'Additional patient payment required: EGP 500.00.',statusCode:409},{status:shape === 'problem' ? 409 : 400,statusText:'Conflict'});
   await start; expect(api.blockedAppointment()).toBe(42);
 });
 it('retains the original receipt key after a timeout, including after service recreation', async () => {
   const first=firstValueFrom(api.collect(42,'original-key',500,'Cash')).catch(e=>e);
   http.expectOne(`${url}/Finance/appointments/42/payments`).error(new ProgressEvent('error')); await first;
   const recreated=TestBed.runInInjectionContext(()=>new CourseFinanceService());
   const retry=firstValueFrom(recreated.collect(42,'different-key',500,'Cash'));
   const request=http.expectOne(`${url}/Finance/appointments/42/payments`);expect(request.request.body.idempotencyKey).toBe('original-key');
   request.flush({appointmentId:42,canStart:true,invoiceId:10,accountKey:'course:1',pricingMode:'Package',patientPaid:500,requiredCumulative:500,additionalPaymentRequired:0,patientBalance:0,consumedSessions:0});await retry;
   expect(sessionStorage.getItem('ptcenter.finance.patient-42')).toBeNull();
 });
 it('separates insurer claim submissions from actual settlement collection methods', async () => {
   const claim=firstValueFrom(api.claim(10,'claim-key','CLAIM-123'));
   http.expectOne(`${url}/Finance/insurance/claims`).flush({id:8,invoiceId:10});await claim;
   const settle=firstValueFrom(api.settle(8,'settle-key',80,'Online','BANK-456'));
   const request=http.expectOne(`${url}/Finance/insurance/claims/8/settlements`);
   expect(request.request.body).toEqual({idempotencyKey:'settle-key',amount:80,method:'Online',settlementReference:'BANK-456'});request.flush({paymentId:100});await settle;
 });
 it('caches valid patient contexts and cancels abandoned lookups', async () => {
   const bookings=TestBed.inject(BookingService);const abandoned=bookings.context(1).subscribe();
   const request=http.expectOne(`${url}/Bookings/patients/1`);abandoned.unsubscribe();expect(request.cancelled).toBe(true);
   const first=firstValueFrom(bookings.context(1));http.expectOne(`${url}/Bookings/patients/1`).flush({patientId:1});await first;
   expect((await firstValueFrom(bookings.context(1))).patientId).toBe(1);http.expectNone(`${url}/Bookings/patients/1`);
   bookings.invalidatePatient(1);const fresh=firstValueFrom(bookings.context(1));http.expectOne(`${url}/Bookings/patients/1`).flush({patientId:1});await fresh;
 });
 it('accepts planned course invoices before an appointment exists', () => {
   const invoice=TestBed.inject(BillingService).normalizeInvoice({id:1,invoiceNumber:'C-3-1',patientName:'Patient',createdAt:'2026-10-30T10:00:00Z',appointmentDate:null,appointmentId:null,patientId:1,type:'Session',status:'Pending',totalAmount:100,patientAmount:20,insuranceAmount:80,paidAmount:0,remainingAmount:20,courseAgreementId:3,treatmentPlanSessionId:8});
   expect(invoice.appointmentId).toBeNull();expect(invoice.courseAgreementId).toBe(3);expect(invoice.patientAmount).toBe(20);
 });
 it('rejects an old or incomplete quote before a financial booking can be confirmed', async () => {
   const preview=firstValueFrom(TestBed.inject(BookingService).preview({} as never));const rejected=expect(preview).rejects.toThrow('could not be verified');
   http.expectOne(`${url}/Bookings/preview`).flush({canSave:true,totalAmount:100,patientAmount:100,insuranceAmount:0,deposit:0,remainingAmount:100});await rejected;
   http.expectNone(`${url}/Bookings`);
 });
 it('retains a complete intent after an unreadable success and blocks changed retry details before HTTP',async()=>{
   const failed=firstValueFrom(api.collect(42,'original',50,'Online')).catch(e=>e);
   http.expectOne(`${url}/Finance/appointments/42/payments`).flush(null);await failed;
   const recreated=TestBed.runInInjectionContext(()=>new CourseFinanceService());
   expect(recreated.pending('patient-42')?.body).toEqual({amount:50,method:'Online'});
   await expect(firstValueFrom(recreated.collect(42,'new',60,'Cash'))).rejects.toThrow('original receipt');
   http.expectNone(`${url}/Finance/appointments/42/payments`);
   const retry=firstValueFrom(recreated.collect(42,'new',50,'Online'));
   const req=http.expectOne(`${url}/Finance/appointments/42/payments`);expect(req.request.body.idempotencyKey).toBe('original');
   req.flush({appointmentId:42,canStart:true,invoiceId:1,patientPaid:50,requiredCumulative:50,additionalPaymentRequired:0,patientBalance:0});await retry;
   expect(recreated.pending('patient-42')).toBeNull();
 });
 it('retains claim and settlement details for recovery instead of accepting an empty receipt',async()=>{
   const failed=firstValueFrom(api.settle(8,'settlement',80,'Online','BANK-456')).catch(e=>e);
   http.expectOne(`${url}/Finance/insurance/claims/8/settlements`).flush({});await failed;
   expect(api.pendingInsurance()[0]).toMatchObject({key:'settlement',body:{amount:80,method:'Online',settlementReference:'BANK-456'}});
   await expect(firstValueFrom(api.settle(8,'new',80,'Online','OTHER'))).rejects.toThrow('original receipt');
   http.expectNone(`${url}/Finance/insurance/claims/8/settlements`);
 });
 it('pins account collection amount and method across service recreation',async()=>{
   const first=firstValueFrom(TestBed.inject(BookingService).collectAccount('course:1',25,'Online')).catch(e=>e);
   const req=http.expectOne(`${url}/Bookings/accounts/course%3A1/payments`);const key=req.request.body.idempotencyKey;
   req.error(new ProgressEvent('error'));await first;
   const recreated=TestBed.runInInjectionContext(()=>new BookingService());
   expect(recreated.pendingCollection()).toMatchObject({key,amount:25,method:'Online'});
   await expect(firstValueFrom(recreated.collectAccount('course:1',26,'Online'))).rejects.toThrow('original receipt');
   http.expectNone(`${url}/Bookings/accounts/course%3A1/payments`);
 });
});
