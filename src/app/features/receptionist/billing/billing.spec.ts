import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController,provideHttpClientTesting } from '@angular/common/http/testing';
import { MessageService } from 'primeng/api';
import { BillingService } from '../../../core/services/billing.service';
import { BillingComponent } from './billing';
import { environment } from '../../../../environments/environment';
import { of, Subject } from 'rxjs';
import { BookingReceipt } from '../../../core/models/booking.model';
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
  it('shows a fresh read-only balance after confirming an uncertain receipt instead of offering its original amount again',()=>{
    const history=new Subject<any[]>();let pending=true;
    vi.spyOn(service,'paymentIntent').mockImplementation(()=>pending?{amount:40,method:0,paidBefore:0,expectedRemaining:150}:undefined as never);
    vi.spyOn(service,'getPaymentsForInvoice').mockReturnValue(history);
    component.openPaymentModal(11);expect(component.amountToCollect).toBe(40);
    pending=false;history.next([{id:71,invoiceId:11,amount:40,method:0,status:1}]);
    expect(component.collectionView).toBe(false);expect(component.amountToCollect).toBe(0);expect(component.selectedPaymentMethod).toBe('');
    expect(component.detailInvoice()).toBeNull();expect(component.paymentHistoryLoading()).toBe(true);
    http.expectOne(environment.apiUrl+'/Billing/invoices/11').flush({...invoice,paidAmount:90,remainingAmount:110});
    expect(component.detailInvoice()?.remainingAmount).toBe(110);expect(component.collectionView).toBe(false);expect(component.paymentHistoryLoading()).toBe(false);
    http.expectNone(request=>request.method==='POST');history.complete();
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
  it('collects a package through its saved course account when its remaining balance spans invoices',async()=>{
    const opening=component.openInvoice(11,true);
    http.expectOne(environment.apiUrl+'/Billing/invoices/11').flush({...invoice,totalAmount:90,patientAmount:90,paidAmount:80,remainingAmount:10});
    http.expectOne(environment.apiUrl+'/Billing/invoices/11/context').flush({id:11,patientId:1,planId:2,agreementId:20,pricingMode:'Package',collectionBlockedReason:null});
    await Promise.resolve();await Promise.resolve();
    http.expectOne(environment.apiUrl+'/Bookings/patients/1').flush({patientId:1,plans:[{id:2,financial:{agreementId:20,remainingAmount:90}}]});
    await opening;expect(component.selectedAccountKey).toBe('course:20');expect(component.amountToCollect).toBe(90);expect(component.allocationReady).toBe(false);
    expect(component.selectedPaymentMethod).toBe('');http.expectNone(request=>request.method==='POST');
  });
  it('gives an unknown numeric invoice status a neutral presentation',()=>{
    expect(component.getStatusSeverity(57)).toBe('secondary');expect(component.getStatusSeverity('Paid')).toBe('success');
  });
  it('keeps insurer invoice amounts separate from recorded patient payments',()=>{
    expect(component.insuranceClaims()[0].insuranceAmount).toBe(300);expect(component.totalRevenue()).toBe(50);
  });
  it('accepts the offered Online method for a saved course account',async()=>{
    sessionStorage.clear();
    component.openAccountPayment({key:'course:1',remainingAmount:100} as never);component.selectedPaymentMethod='Online';component.amountToCollect=25;component.allocation.set({accountKey:'course:1',amount:25,hash:'preview-hash',remaining:100,items:[]});
    const collect=vi.spyOn(component.bookingApi,'collectAccount').mockReturnValue(of({} as BookingReceipt));
    vi.spyOn(component,'refreshAccounts').mockImplementation(()=>{});vi.spyOn(service,'getInvoices').mockImplementation(()=>{});
    await component.confirmPayment();expect(collect).toHaveBeenCalledWith('course:1',25,'Online','preview-hash');expect(component.paymentError()).toBe('');
  });
});
