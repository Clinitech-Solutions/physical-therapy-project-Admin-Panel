import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController,provideHttpClientTesting } from '@angular/common/http/testing';
import { MessageService } from 'primeng/api';
import { BillingService } from '../../../core/services/billing.service';
import { BillingComponent } from './billing';
import { environment } from '../../../../environments/environment';
const invoice={id:11,invoiceNumber:'INV-11',appointmentId:10,patientId:1,patientName:'Patient',patientPhone:null,insuranceCompany:null,
  type:72,totalAmount:500,insuranceAmount:300,patientAmount:200,paidAmount:50,remainingAmount:150,status:57,appointmentDate:'2026-11-01T09:00:00Z',createdAt:new Date().toISOString(),paymentMethod:null};
describe('Billing component with backend invoice data',()=>{
  let component:BillingComponent;let service:BillingService;let http:HttpTestingController;
  beforeEach(()=>{
    TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting(),MessageService]});
    service=TestBed.inject(BillingService);http=TestBed.inject(HttpTestingController);
    service.invoices.set([service.normalizeInvoice(invoice)]);
    component=TestBed.runInInjectionContext(()=>new BillingComponent());
  });
  afterEach(()=>http.verify());
  it('keeps invoices visible when their type and status are unidentified',()=>{
    expect(component.dailyCashierInvoices()).toHaveLength(1);expect(service.mapStatusToString(57)).toBe('Unknown');
  });
  it('opens saved invoice details using the actual remaining balance without defaulting a payment method',()=>{
    component.openPaymentModal(11);http.expectOne(environment.apiUrl+'/Billing/invoices/11/payments').flush([]);
    expect(component.amountToCollect).toBe(150);expect(component.selectedPaymentMethod).toBe('');
    expect(component.paymentMethods).toEqual(['Cash','Visa','EWallet','BankTransfer','Online']);expect(component.showPaymentModal).toBe(true);
  });
  it('shows history failures independently of invoice details',()=>{
    component.openPaymentModal(11);http.expectOne(environment.apiUrl+'/Billing/invoices/11/payments').flush({}, {status:403,statusText:'Forbidden'});
    expect(component.paymentHistoryError()).toBeTruthy();expect(component.showPaymentModal).toBe(true);
  });
  it('uses recorded payments and balances instead of invoice charges as collections',()=>{
    expect(component.totalRevenue()).toBe(50);expect(component.pendingPaymentsTotal()).toBe(150);
    expect(component.cashCollectedToday()).toBeNull();expect(component.digitalCollectedToday()).toBeNull();
  });
  it('opens a saved installment account without inventing a payment or a payment method',()=>{
    component.openAccountPayment({key:'saved-account',patientId:1,patientName:'Patient',pricingMode:'Package',totalAmount:500,discount:0,patientAmount:500,insuranceAmount:0,paidAmount:100,remainingAmount:400,invoiceIds:[11],installments:[{dueDate:'2030-01-01',amount:400}]});
    expect(component.selectedAccountKey).toBe('saved-account');expect(component.amountToCollect).toBe(400);expect(component.selectedPaymentMethod).toBe('');
    http.expectNone(request=>request.method==='POST');
  });
  it('gives an unknown numeric invoice status a neutral presentation',()=>{
    expect(component.getStatusSeverity(57)).toBe('secondary');expect(component.getStatusSeverity('Paid')).toBe('success');
  });
  it('keeps insurer invoice amounts separate from recorded patient payments',()=>{
    expect(component.insuranceClaims()[0].insuranceAmount).toBe(300);expect(component.totalRevenue()).toBe(50);
  });
});
