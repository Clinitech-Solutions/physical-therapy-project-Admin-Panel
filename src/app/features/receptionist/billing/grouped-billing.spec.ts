import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { GroupedBillingComponent } from './grouped-billing';
import { AuthService } from '../../../core/services/auth';
import { BillingPage, BillingPatient } from '../../../core/services/grouped-billing.service';
import { environment } from '../../../../environments/environment';

const amounts={agreed:200,patientLiability:40,patientReceipts:40,patientRemaining:0,collectedInPeriod:0,insurerPlanned:0,insurerEarned:0,claimsSubmitted:0,insurerReceipts:0,insurerEarnedOutstanding:0,receiptCount:2};
const page:BillingPage<BillingPatient>={items:[{patientId:1,name:'Same Patient',phone:'01000',funding:'Insurance',companies:['Saved insurer'],invoiceCount:2,amounts,patientStatus:'Settled',fullySettled:false}],matchingPatients:1,matchingInvoices:2,page:1,pageSize:20,totals:amounts,dateBasis:'Invoice',timezone:'Africa/Cairo'};
describe('Patient grouped billing report',()=>{
  function setup() {
    TestBed.configureTestingModule({imports:[GroupedBillingComponent,TranslateModule.forRoot()],providers:[provideHttpClient(),provideHttpClientTesting(),{provide:AuthService,useValue:{hasRole:()=>false}}]});
    const fixture=TestBed.createComponent(GroupedBillingComponent),http=TestBed.inject(HttpTestingController);fixture.changeDetectorRef.markForCheck();fixture.detectChanges();
    http.expectOne(environment.apiUrl+'/Billing/filter-options').flush({companies:[{id:'1',name:'Saved insurer'}],plans:[],clinicians:[]});
    http.expectOne(r=>r.url.endsWith('/Billing/patients')).flush(page);fixture.changeDetectorRef.markForCheck();fixture.detectChanges();
    return {fixture,c:fixture.componentInstance,http};
  }
  it('renders backend patient counts and balances with separate patient and insurer settlement meaning',()=>{
    const {fixture,http}=setup();expect(fixture.nativeElement.querySelectorAll('.patient-row')).toHaveLength(1);expect(fixture.nativeElement.textContent).toContain('Insurer balance remains');expect(fixture.nativeElement.textContent).toContain('2 invoices');expect(fixture.nativeElement.querySelector('.actions button').disabled).toBe(true);fixture.destroy();http.verify();
  });
  it('keeps details accessible and collection disabled when the patient share is paid',()=>{
    const {fixture,c,http}=setup();c.toggle(1);http.expectOne(r=>r.url.endsWith('/patients/1/invoices')).flush({...page,items:[{id:11,reference:'I-11',type:'Session',status:'Pending',patientShare:40,insurerShare:160,createdAt:'2026-11-05T22:00:00Z',funding:'Insurance',company:'Saved insurer',amounts,collectionBlockedReason:'Patient share fully paid'}]});fixture.changeDetectorRef.markForCheck();fixture.detectChanges();
    const buttons=fixture.nativeElement.querySelectorAll('.invoice-actions button');expect(buttons[0].disabled).toBe(false);expect(buttons[1].disabled).toBe(true);const spy=vi.spyOn(c.invoiceAction,'emit');buttons[0].click();expect(spy).toHaveBeenCalledWith({id:11,collect:false});fixture.destroy();http.verify();
  });
  it('applies a complex range only on Apply and carries it to expansion and pagination',()=>{
    const {fixture,c,http}=setup();c.draft={dateBasis:'Collection',from:'2026-04-24',to:'2026-04-25',companyIds:[1,2],method:'0'};fixture.changeDetectorRef.markForCheck();fixture.detectChanges();http.expectNone(r=>r.url.endsWith('/Billing/patients'));c.apply();
    const req=http.expectOne(r=>r.url.endsWith('/Billing/patients'));expect(req.request.params.getAll('companyIds')).toEqual(['1','2']);expect(req.request.params.get('from')).toBe('2026-04-24');req.flush(page);c.loadInvoices(1,2);const detail=http.expectOne(r=>r.url.endsWith('/patients/1/invoices'));expect(detail.request.params.get('dateBasis')).toBe('Collection');expect(detail.request.params.get('page')).toBe('2');detail.flush({...page,items:[]});fixture.destroy();http.verify();
  });
  it('cancels stale summary and expansion requests when the filter scope changes',()=>{
    const {fixture,c,http}=setup();c.loadInvoices(1);const oldDetail=http.expectOne(r=>r.url.endsWith('/patients/1/invoices'));c.refresh();const oldSummary=http.expectOne(r=>r.url.endsWith('/Billing/patients'));c.draft.search='New';c.apply();expect(oldDetail.cancelled).toBe(true);expect(oldSummary.cancelled).toBe(true);http.expectOne(r=>r.url.endsWith('/Billing/patients')).flush({...page,items:[],matchingPatients:0,matchingInvoices:0});expect(c.result()?.items).toHaveLength(0);fixture.destroy();http.verify();
  });
  it('removes one company chip and resets predictably',()=>{
    const {fixture,c,http}=setup();c.applied={dateBasis:'Service',companyIds:[1,2],funding:'Insurance'};c.remove('companyIds',1);let req=http.expectOne(r=>r.url.endsWith('/Billing/patients'));expect(req.request.params.getAll('companyIds')).toEqual(['2']);req.flush(page);c.clear();req=http.expectOne(r=>r.url.endsWith('/Billing/patients'));expect(req.request.params.get('dateBasis')).toBe('Invoice');expect(req.request.params.has('companyIds')).toBe(false);req.flush(page);fixture.destroy();http.verify();
  });
  it('recovers a failed expansion without hiding the summary',()=>{
    const {fixture,c,http}=setup();c.toggle(1);http.expectOne(r=>r.url.endsWith('/patients/1/invoices')).flush({detail:'Unavailable'},{status:503,statusText:'Unavailable'});fixture.changeDetectorRef.markForCheck();fixture.detectChanges();expect(c.result()?.matchingInvoices).toBe(2);expect(fixture.nativeElement.querySelector('.invoice-expansion [role=alert]')).toBeTruthy();c.loadInvoices(1);http.expectOne(r=>r.url.endsWith('/patients/1/invoices')).flush({...page,items:[]});expect(c.expansions()[1].error).toBe('');fixture.destroy();http.verify();
  });
  it('exports the applied filter scope with a selected detail format',()=>{
    const {fixture,c,http}=setup();c.applied={dateBasis:'Collection',from:'2026-11-06',companyIds:[1]};c.exportKind='invoices';c.export();const req=http.expectOne(r=>r.url.endsWith('/Billing/export'));expect(req.request.params.get('kind')).toBe('invoices');expect(req.request.params.get('dateBasis')).toBe('Collection');expect(req.request.params.get('from')).toBe('2026-11-06');req.flush(new Blob(['Unavailable']), {status:503,statusText:'Unavailable'});expect(c.exporting).toBe(false);fixture.destroy();http.verify();
  });
  it('supports Arabic labels, RTL and keyboard-native expansion controls',()=>{
    const {fixture,c,http}=setup();TestBed.inject(TranslateService).use('ar');fixture.changeDetectorRef.markForCheck();fixture.changeDetectorRef.markForCheck();fixture.detectChanges();expect(fixture.nativeElement.querySelector('section').dir).toBe('rtl');expect(fixture.nativeElement.textContent).toContain('حصة المريض');expect(fixture.nativeElement.querySelector('.expand').tagName).toBe('BUTTON');expect(c.initials('  Mariam Adel Samir ')).toBe('MA');fixture.destroy();http.verify();
  });
});
