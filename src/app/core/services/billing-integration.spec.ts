import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { MessageService } from 'primeng/api';
import { BillingService } from './billing.service';
import { RECEPTION_ENUMS } from './reception-contracts';
import { InsuranceDocumentService } from './insurance-document.service';
import { ClinicalRecordsService } from './clinical-records.service';
import { PatientProfileComponent } from '../../shared/components/patient-profile/patient-profile.component';
import { BillingComponent } from '../../features/receptionist/billing/billing';
import { environment } from '../../../environments/environment';

const url=environment.apiUrl;
export const invoiceFixture={id:11,invoiceNumber:'INV-11',appointmentId:10,patientId:1,patientName:'Patient',patientPhone:null,insuranceCompany:'Insurer',
  type:72,totalAmount:500,insuranceAmount:300,patientAmount:200,paidAmount:50,remainingAmount:150,status:57,appointmentDate:'2026-11-01T09:00:00Z',createdAt:'2026-10-26T10:00:00Z',paymentMethod:null};
describe('Reception billing and profile persistence',()=>{
  let http:HttpTestingController;let billing:BillingService;
  beforeEach(()=>{
    TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting(),MessageService,
      // Arbitrary verified test definitions exercise transport without assuming production enum values.
      {provide:RECEPTION_ENUMS,useValue:{paymentMethod:{Cash:27}}}
    ]});
    http=TestBed.inject(HttpTestingController);billing=TestBed.inject(BillingService);
  });
  afterEach(()=>http.verify());
  it('preserves documented paid and remaining amounts without inferring status or daily collections',()=>{
    const invoice=billing.normalizeInvoice(invoiceFixture);billing.invoices.set([invoice]);
    expect(invoice.paidAmount).toBe(50);expect(invoice.remainingBalance).toBe(150);
    expect(invoice.status).toBe(57);expect(billing.mapStatusToString(invoice.status)).toBe('Unknown');
    expect(billing.collectedTodayRevenue()).toBeNull();expect(billing.cashCollectedToday()).toBeNull();
    expect(()=>billing.normalizeInvoice({...invoiceFixture,remainingAmount:undefined})).toThrow();
  });
  it('loads direct invoice arrays and exposes a later refresh failure without deleting cached records',()=>{
    billing.getInvoices();http.expectOne(`${url}/Billing/invoices`).flush([invoiceFixture]);
    billing.getInvoices();http.expectOne(`${url}/Billing/invoices`).flush({}, {status:500,statusText:'Error'});
    expect(billing.invoices()[0].id).toBe(11);expect(billing.error()).toBeTruthy();
  });
  it('posts a payment only against a real saved invoice, then requires balance reconciliation',async()=>{
    billing.invoices.set([billing.normalizeInvoice(invoiceFixture)]);
    const result=firstValueFrom(billing.recordPayment({invoiceId:11,amount:40,method:27}));
    const req=http.expectOne(`${url}/Billing/payments`);expect(req.request.body).toEqual({invoiceId:11,amount:40,method:27});req.flush(null);await result;
    expect(billing.invoices()[0].paidAmount).toBe(50); // no optimistic financial mutation
    await expect(firstValueFrom(billing.recordPayment({invoiceId:11,amount:40,method:27}))).rejects.toThrow('Verify');
    billing.getInvoices();http.expectOne(`${url}/Billing/invoices`).flush([{...invoiceFixture,paidAmount:90,remainingAmount:110}]);
    expect(billing.pendingPaymentInvoices()).toEqual([]);
  });
  it('blocks replay of an unknown payment outcome',async()=>{
    billing.invoices.set([billing.normalizeInvoice(invoiceFixture)]);
    const result=firstValueFrom(billing.recordPayment({invoiceId:11,amount:40,method:27}));const rejected=expect(result).rejects.toThrow();
    http.expectOne(`${url}/Billing/payments`).error(new ProgressEvent('error'));await rejected;
    expect(billing.mutation.uncertain()).toBe(true);
    await expect(firstValueFrom(billing.recordPayment({invoiceId:11,amount:40,method:27}))).rejects.toThrow('previous operation');
  });
  it.each([0,NaN,151,1000000000])('rejects invalid or excessive payment %s before HTTP',async amount=>{
    billing.invoices.set([billing.normalizeInvoice(invoiceFixture)]);
    await expect(firstValueFrom(billing.recordPayment({invoiceId:11,amount,method:27}))).rejects.toThrow();
    expect(billing.mutation.busy()).toBe(false);http.expectNone(`${url}/Billing/payments`);
  });
  it('re-reads a changed invoice and prevents overcollection from stale screen data',async()=>{
    billing.invoices.set([billing.normalizeInvoice(invoiceFixture)]);
    const component=TestBed.runInInjectionContext(()=>new BillingComponent());component.selectedInvoiceId=11;component.selectedPaymentMethod='Cash';component.amountToCollect=150;
    const result=component.confirmPayment();
    http.expectOne(`${url}/Billing/invoices/11`).flush({...invoiceFixture,paidAmount:190,remainingAmount:10});await result;
    expect(component.paymentError()).toContain('saved invoice balance');http.expectNone(`${url}/Billing/payments`);
  });
  it('does not infer a payment method or invoice status definition',()=>{
    expect(()=>billing.mapStatusToNumber('Paid')).toThrow('confirmed backend');
    expect(()=>billing.mapPaymentMethodToNumber('Card')).toThrow('confirmed backend');
  });
  it('exposes payment-history schema failures without reporting an empty successful history',async()=>{
    const result=firstValueFrom(billing.getPaymentsForInvoice(11));const rejected=expect(result).rejects.toThrow('verification');
    http.expectOne(`${url}/Billing/invoices/11/payments`).flush({unverified:[]});await rejected;
  });
  it('does not expose unverified documents for another patient',async()=>{
    const result=firstValueFrom(TestBed.inject(InsuranceDocumentService).getDocumentsForPatient(1));const rejected=expect(result).rejects.toThrow('patient association');
    http.expectOne(`${url}/InsuranceDocuments`).flush([{id:99,patientId:2}]);await rejected;
  });
  it('renders only saved clinical sessions and never fills a plan with synthetic records',()=>{
    const clinical=TestBed.inject(ClinicalRecordsService);
    clinical.assessments.set([{id:1,patientId:1} as never]);clinical.plans.set([{id:5,assessmentId:1,doctorId:'doctor-guid',doctorName:'Doctor',numberOfSessions:10,completedSessions:2} as never]);
    clinical.sessions.set([{id:20,treatmentPlanId:5,sessionNumber:1,sessionDate:null,checkIn:null,checkOut:null,status:89} as never]);
    const component=TestBed.runInInjectionContext(()=>new PatientProfileComponent());component.patientId='1';
    expect(component.sessions.map(s=>s.id)).toEqual(['20']);expect(component.totalSessions).toBe(10);
    expect(component.completedSessionsCount).toBe(2);expect(component.sessions[0].status).toBe('Unknown');
  });
});
