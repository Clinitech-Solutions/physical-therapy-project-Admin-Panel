import { Component, OnDestroy, OnInit, Output, EventEmitter, Input, inject, signal, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { GroupedBillingService, BillingFilters, BillingPage, BillingPatient, BillingInvoice, BillingOptions } from '../../../core/services/grouped-billing.service';
import { ReceptionistLocale } from '../../../shared/receptionist-locale';
import { ReceptionContracts } from '../../../core/services/reception-contracts';
import { AuthService } from '../../../core/services/auth';
import { apiError } from '../../../core/services/reception-api';
import { billingArabic } from './billing-text';

@Component({ selector: 'app-grouped-billing', standalone: true, imports: [CommonModule, FormsModule], templateUrl: './grouped-billing.html', styleUrls: ['./grouped-billing.css', './grouped-billing-filters.css', './grouped-billing-table.css', './grouped-billing-responsive.css'] })
export class GroupedBillingComponent implements OnInit, OnDestroy {
  readonly api = inject(GroupedBillingService); readonly locale = new ReceptionistLocale();
  readonly contracts = inject(ReceptionContracts); private readonly auth = inject(AuthService, { optional: true });
  private readonly element: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly route = inject(ActivatedRoute, { optional: true }); private readonly router = inject(Router, { optional: true });
  @Input() collectionLocked = false;
  @Output() invoiceAction = new EventEmitter<{id: number; collect: boolean}>();
  @Output() profile = new EventEmitter<number>();
  readonly result = signal<BillingPage<BillingPatient> | null>(null); readonly error = signal(''); readonly loading = signal(false);
  readonly options = signal<BillingOptions>({ companies: [], plans: [], clinicians: [] }); readonly optionsError = signal('');
  readonly expansions = signal<Record<number, { loading: boolean; error: string; data?: BillingPage<BillingInvoice> }>>({});
  expanded = new Set<number>(); private requests = new Map<number, Subscription>(); private request?: Subscription; private optionRequest?: Subscription; private routeRequest?: Subscription; private exportRequest?: Subscription;
  private defaults(): BillingFilters { return {dateBasis:'Invoice',companyIds:[],search:'',funding:'',patientStatus:'',type:'',pricingMode:'',status:'',appointmentStatus:'',sessionStatus:'',planId:'',clinicianId:'',method:'',claimStatus:''}; }
  draft: BillingFilters = this.defaults(); applied: BillingFilters = { ...this.draft }; page = 1; advanced = false; filtersOpen = false; exporting = false; exportKind = 'patients';
  get finance() { return ['Ceo', 'Admin', 'Owner', 'SuperAdmin'].some(role=>this.auth?.hasRole(role)); }
  get mobile() { return typeof window !== 'undefined' && window.innerWidth<=600; }
  toggleAdvanced() {
    if(this.advanced){this.closeAdvanced();return;}
    this.advanced=true;
    setTimeout(()=>{const panel=this.element.nativeElement.querySelector<HTMLDialogElement>('#billing-advanced');if(panel){if(this.mobile)panel.showModal();else panel.show();}});
  }
  closeAdvanced() { this.element.nativeElement.querySelector<HTMLDialogElement>('#billing-advanced')?.close();this.advanced=false;this.element.nativeElement.querySelector<HTMLButtonElement>('.advanced-toggle')?.focus(); }
  filterKeys(event:KeyboardEvent) {
    if(event.key==='Escape'){event.preventDefault();this.closeAdvanced();return;}
    if(!this.mobile || event.key!=='Tab')return;
    const controls=Array.from(this.element.nativeElement.querySelectorAll<HTMLElement>('#billing-advanced button,#billing-advanced select'));
    const first=controls[0],last=controls.at(-1);
    if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
  }
  t(text: string): string { const english: Record<string,string>={SelfPay:'Self-pay',PerSession:'Per session',Settled:'Patient settled',NonCollectible:'Non-collectible',Invoice:'Invoice date',Service:'Service delivery date',Collection:'Collection date'};return this.locale.language === 'ar-EG' ? billingArabic[text] ?? this.locale.label(text) : english[text] ?? text; }
  companyLabel(companies:string[]) { const known=companies.filter(name=>name!=='Historical company unavailable');return known.length>1?this.t('Multiple companies'):known[0] || this.t('Historical company unavailable'); }
  get selectedCompanies() { return this.options().companies.filter(company=>this.draft.companyIds?.includes(+company.id)).map(c=>c.name).join(', ') || this.t('All'); }
  setCompany(id:number,event:Event) { const selected=(event.target as HTMLInputElement).checked;this.draft.companyIds=selected?[...(this.draft.companyIds ?? []),id]:(this.draft.companyIds ?? []).filter(value=>value!==id); }
  money(amount: number) { return new Intl.NumberFormat(this.locale.language, { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 }).format(amount); }
  initials(name: string) { return name.trim().split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase(); }
  enumOptions(kind: 'invoiceType'|'invoiceStatus'|'appointmentStatus'|'sessionStatus'|'paymentMethod') { return Object.entries(this.contracts.enums[kind] ?? {}).filter(([name])=>kind!=='paymentMethod'||name!=='Insurance'); }
  ngOnInit() {
    this.loadOptions();
    if(this.route) this.routeRequest=this.route.queryParamMap.subscribe(params=>{
      const filters: BillingFilters={...this.defaults(),dateBasis:params.get('dateBasis') || 'Invoice',companyIds:params.getAll('companyIds').map(Number)};
      for(const key of ['search','funding','from','to','patientStatus','type','pricingMode','status','appointmentStatus','sessionStatus','planId','clinicianId','method','claimStatus'] as const) { const value=params.get(key); if(value) filters[key]=value; }
      this.applied=filters;this.draft=structuredClone(filters);this.page=Math.max(1,Number(params.get('page'))||1);this.refresh();
    }); else this.refresh();
  }
  ngOnDestroy() { this.request?.unsubscribe();this.optionRequest?.unsubscribe();this.routeRequest?.unsubscribe();this.exportRequest?.unsubscribe();for(const request of this.requests.values()) request.unsubscribe(); }
  loadOptions() { this.optionRequest?.unsubscribe();this.optionsError.set('');this.optionRequest=this.api.options().subscribe({next:options=>this.options.set(options),error:e=>this.optionsError.set(apiError(e))}); }
  apply() { if(this.draft.from && this.draft.to && this.draft.from>this.draft.to) {this.error.set(this.t('From')+' ≤ '+this.t('To'));return;} this.applied=structuredClone(this.draft);this.page=1;this.advanced=false;this.element.nativeElement.querySelectorAll<HTMLDetailsElement>('.company-picker details').forEach(el=>el.open=false);this.navigate(); }
  clear() { this.draft=this.defaults();this.apply(); }
  navigate() { if(this.router && this.route) void this.router.navigate([], {relativeTo:this.route,queryParams:{...this.applied,page:this.page},replaceUrl:true});else this.refresh(); }
  refresh() {
    this.request?.unsubscribe();for(const request of this.requests.values()) request.unsubscribe();this.requests.clear();this.expanded.clear();this.expansions.set({});
    this.loading.set(true);this.error.set('');this.result.set(null);
    this.request=this.api.patients(this.applied,this.page).subscribe({next:data=>{this.result.set(data);this.loading.set(false);},error:e=>{this.error.set(apiError(e));this.loading.set(false);}});
  }
  turn(page: number) { this.page=page;this.navigate(); }
  toggle(patientId: number) { if(this.expanded.has(patientId))this.expanded.delete(patientId);else {this.expanded.add(patientId);if(!this.expansions()[patientId])this.loadInvoices(patientId);} }
  chooseInvoice(patientId: number) { this.expanded.add(patientId);if(!this.expansions()[patientId])this.loadInvoices(patientId); }
  loadInvoices(patientId: number,page=1) {
    this.requests.get(patientId)?.unsubscribe();this.expansions.update(value=>({...value,[patientId]:{loading:true,error:''}}));
    this.requests.set(patientId,this.api.invoices(patientId,this.applied,page).subscribe({next:data=>this.expansions.update(value=>({...value,[patientId]:{loading:false,error:'',data}})),error:e=>this.expansions.update(value=>({...value,[patientId]:{loading:false,error:apiError(e)}}))}));
  }
  get chips() { return Object.entries(this.applied).filter(([key,value])=>key!=='dateBasis' && value!=null && value!=='' && (!Array.isArray(value)||value.length)).flatMap(([key,value])=>Array.isArray(value)?value.map(id=>({key,value:id,label:this.t('Insurance companies')+': '+(this.options().companies.find(c=>Number(c.id)===id)?.name ?? id)})):[{key,value,label:this.chipLabel(key,String(value))}]); }
  private chipLabel(key:string,value:string) { const label:Record<string,string>={search:'Search name or phone',funding:'Funding',from:'From',to:'To',patientStatus:'Patient payment status',type:'Invoice type',pricingMode:'Pricing mode',status:'Invoice status',appointmentStatus:'Appointment status',sessionStatus:'Session status',planId:'Treatment plan',clinicianId:'Actual treating clinician',method:'Collection method',claimStatus:'Claim status'};
    const enums: Record<string,'invoiceType'|'invoiceStatus'|'appointmentStatus'|'sessionStatus'|'paymentMethod'>={type:'invoiceType',status:'invoiceStatus',appointmentStatus:'appointmentStatus',sessionStatus:'sessionStatus',method:'paymentMethod'};
    return this.t(label[key] ?? key)+': '+this.t(enums[key]?this.contracts.label(enums[key],value):value); }
  remove(key:string,value:unknown) { this.draft=structuredClone(this.applied);if(key==='companyIds')this.draft.companyIds=this.draft.companyIds?.filter(id=>id!==value);else delete (this.draft as unknown as Record<string,unknown>)[key];this.apply(); }
  export() { if(this.exporting)return;this.exporting=true;this.error.set('');this.exportRequest=this.api.export(this.applied,this.exportKind).subscribe({next:blob=>{const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`billing-${this.exportKind}.csv`;link.click();URL.revokeObjectURL(url);this.exporting=false;},error:e=>{this.error.set(apiError(e));this.exporting=false;}}); }
}
