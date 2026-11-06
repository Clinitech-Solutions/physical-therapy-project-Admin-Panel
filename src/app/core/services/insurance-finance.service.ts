import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, tap, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { GroupedBillingService, BillingInvoice } from './grouped-billing.service';
import { CourseFinanceService, FinancialIntent } from './course-finance.service';
import { ReceptionError, ReceptionEvents } from './reception-api';

export interface InsuranceFilters {
  companyId?: number; serviceMonth?: string; companySearch?: string; search?: string; claimReference?: string;
  paymentState?: string; claimStatus?: string; from?: string; to?: string; type?: string; pricingMode?: string;
  status?: string; appointmentStatus?: string; sessionStatus?: string; planId?: string; clinicianId?: string;
}
export interface InsurerAmounts { sessions:number; earned:number; submitted:number; receipts:number; remaining:number; receiptCount:number; }
export interface CompanyAccount { companyId:number; name:string; amounts:InsurerAmounts; undatedInvoices:number; }
export interface CompanyPage { items:CompanyAccount[]; matchingCompanies:number; matchingInvoices:number; page:number; pageSize:number; totals:InsurerAmounts; unavailableCompanyInvoices:number; undatedInvoices:number; }
export interface InsuranceMonth { month:string; amounts:InsurerAmounts; }
export interface InsurerPatient { patientId:number; name:string; phone:string|null; amounts:InsurerAmounts; state:string; }
export interface MonthAccount { companyId:number; company:string; serviceMonth:string; months:InsuranceMonth[]; patients:InsurerPatient[]; matchingPatients:number; matchingInvoices:number; page:number; pageSize:number; totals:InsurerAmounts; unavailableEvidenceInvoices:number; }
export interface InsurerSession { invoice:BillingInvoice; claimId:number|null; submissionBatchId:number|null; claimReference:string|null; submittedAt:string|null; submittedAmount:number; claimState:string; canSubmitClaim:boolean; }
export interface InsurerSessionPage { items:InsurerSession[]; matchingInvoices:number; page:number; pageSize:number; totals:InsurerAmounts; }
export interface ChequeDraft { companyId:number; serviceMonths:string[]; claimIds:number[]; chequeNumber:string; bankName:string; amount:number; receivedOn:string; chequeDate?:string|null; notes?:string|null; expectedAllocationHash?:string|null; }
export interface ChequeAllocation { paymentId:number; claimId:number; invoiceId:number; invoiceReference:string; patientId:number; patientName:string; serviceMonth:string; serviceDate:string; claimReference:string; before:number; amount:number; after:number; }
export interface ChequePreview { companyId:number; company:string; serviceMonths:string[]; amount:number; before:number; after:number; hash:string; allocations:ChequeAllocation[]; }
export interface ChequeReceipt { id:number; idempotencyKey:string; companyId:number; company:string; chequeNumber:string; bankName:string; amount:number; receivedOn:string; chequeDate:string|null; notes:string|null; recordedBy:string; recordedAt:string; allocations:ChequeAllocation[]; }
export interface LegacyInsurerReceipt { paymentId:number; invoiceId:number; invoiceReference:string; claimId:number|null; reference:string|null; amount:number; receivedAt:string; method:string; }
export interface ReceiptHistory { items:ChequeReceipt[]; matchingReceipts:number; page:number; pageSize:number; actualReceiptTotal:number; allocatedToScope:number; legacyReceipts:LegacyInsurerReceipt[]; legacyReceiptTotal:number; }
export interface MonthlyClaimDraft { companyId:number; serviceMonth:string; invoiceIds:number[]; reference:string; }
export interface MonthlyClaimReceipt { id:number; companyId:number; serviceMonth:string; reference:string; recordedAt:string; recordedBy:string; claimIds:number[]; amount:number; }

@Injectable({providedIn:'root'})
export class InsuranceFinanceService {
  private readonly http=inject(HttpClient);private readonly grouped=inject(GroupedBillingService);
  readonly operations=inject(CourseFinanceService);private readonly events=inject(ReceptionEvents);
  private readonly url=`${environment.apiUrl}/Finance/insurance`;
  private params(q:InsuranceFilters,page=1,pageSize=20) { return this.grouped.params({...q,dateBasis:'Invoice'},page,pageSize); }
  companies(q:InsuranceFilters,page=1) { return this.http.get<CompanyPage>(`${this.url}/companies`,{params:this.params(q,page)}); }
  account(company:number,q:InsuranceFilters,page=1) { return this.http.get<MonthAccount>(`${this.url}/companies/${company}/account`,{params:this.params(q,page)}); }
  sessions(company:number,patient:number,q:InsuranceFilters,page=1) { return this.http.get<InsurerSessionPage>(`${this.url}/companies/${company}/patients/${patient}/sessions`,{params:this.params(q,page,10)}); }
  selection(company:number,q:InsuranceFilters) { return this.http.get<InsurerSession[]>(`${this.url}/companies/${company}/selection`,{params:this.params(q)}); }
  statementData(company:number,q:InsuranceFilters) { return this.http.get<InsurerSession[]>(`${this.url}/companies/${company}/statement-data`,{params:this.params(q)}); }
  history(q:InsuranceFilters,page=1) { return this.http.get<ReceiptHistory>(`${this.url}/receipts`,{params:this.params(q,page)}); }
  statement(company:number,q:InsuranceFilters) { return this.http.get(`${this.url}/companies/${company}/statement`,{params:this.params(q),responseType:'blob'}); }
  receipt(id:number) { return this.http.get<ChequeReceipt>(`${this.url}/cheques/${id}`).pipe(map(value=>this.validReceipt(value))); }
  preview(request:ChequeDraft,key:string) { return this.http.post<ChequePreview>(`${this.url}/cheques/preview`,{...request,idempotencyKey:key}).pipe(timeout(20000)); }
  private canonical(request:ChequeDraft) { return {...request,serviceMonths:[...request.serviceMonths].sort(),claimIds:[...request.claimIds].sort((a,b)=>a-b)}; }
  record(request:ChequeDraft,key:string) {
    const draft=this.canonical(request);return this.operations.operation(`cheque-${draft.companyId}`,key,{request:JSON.stringify(draft)},stable=>
      this.http.post<ChequeReceipt>(`${this.url}/cheques`,{...draft,idempotencyKey:stable}).pipe(map(value=>this.validReceipt(value,draft,stable))))
      .pipe(tap(()=>this.events.changed.next('billing')));
  }
  submit(request:MonthlyClaimDraft,key:string) {
    const draft={...request,invoiceIds:[...request.invoiceIds].sort((a,b)=>a-b)};
    return this.operations.operation(`monthly-${draft.companyId}-${draft.serviceMonth}`,key,{request:JSON.stringify(draft)},stable=>
      this.http.post<MonthlyClaimReceipt>(`${this.url}/monthly-claims`,{...draft,idempotencyKey:stable}).pipe(map(value=>{
        if(!value || value.id<1 || value.companyId!==draft.companyId || value.serviceMonth!==draft.serviceMonth || value.reference!==draft.reference.trim() || value.claimIds.length!==draft.invoiceIds.length || value.amount<0)throw new ReceptionError('OPERATION_OUTCOME_UNKNOWN','The claim submission response could not be verified. Reconcile the original operation.');return value;
      })));
  }
  reconcile(operation:FinancialIntent) {
    const cheque=operation.scope.startsWith('cheque-');const draft=JSON.parse(String(operation.body['request']));
    return this.http.get<ChequeReceipt|MonthlyClaimReceipt>(`${this.url}/${cheque?'cheques':'monthly-claims'}/operations/${encodeURIComponent(operation.key)}`).pipe(
      map(value=>{
        if(cheque)return this.validReceipt(value as ChequeReceipt,draft,operation.key);
        const submission=value as MonthlyClaimReceipt;if(submission.companyId!==draft.companyId || submission.serviceMonth!==draft.serviceMonth || submission.reference!==draft.reference.trim() || submission.claimIds.length!==draft.invoiceIds.length)throw new ReceptionError('OPERATION_OUTCOME_UNKNOWN','The saved submission did not match the original operation.');return submission;
      }),tap(()=>this.operations.resolveOperation(operation.scope,operation.key)));
  }
  retry(operation:FinancialIntent) { const draft=JSON.parse(String(operation.body['request']));return operation.scope.startsWith('cheque-')?this.record(draft,operation.key):this.submit(draft,operation.key); }
  private validReceipt(value:ChequeReceipt,draft?:ChequeDraft,key?:string):ChequeReceipt {
    if(!value || !Number.isSafeInteger(value.id) || value.id<1 || !Array.isArray(value.allocations) || value.allocations.length===0 ||
      !Number.isFinite(value.amount) || value.amount<=0 || Math.abs(value.allocations.reduce((sum,row)=>sum+row.amount,0)-value.amount)>.005 ||
      value.allocations.some(row=>row.amount<=0 || row.paymentId<1 || row.after<0 || Math.abs(row.before-row.amount-row.after)>.005) ||
      draft && (value.companyId!==draft.companyId || value.amount!==draft.amount || value.chequeNumber!==draft.chequeNumber.trim() || value.bankName!==draft.bankName.trim() || value.receivedOn!==draft.receivedOn) || key && value.idempotencyKey!==key)
      throw new ReceptionError('OPERATION_OUTCOME_UNKNOWN','The cheque response could not be verified. Reconcile the original receipt before another collection.');
    return value;
  }
}
