import { apiError, localDay, ReceptionError } from '../../../core/services/reception-api';
import { ReceptionistLocale, ReceptionistTextPipe } from '../../../shared/receptionist-locale';
import { Component, OnInit, computed, inject, signal, Input, forwardRef, ViewChild } from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { CommonModule } from "@angular/common";
import { TranslateModule } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { BillingService, Invoice, Payment } from '../../../core/services/billing.service';
import { MessageService } from 'primeng/api';
import { PatientService } from '../../../core/services/patient.service';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { BookingService } from '../../../core/services/booking.service';
import { BookingAccount, BookingPaymentMethod } from '../../../core/models/booking.model';
import { TabsModule } from 'primeng/tabs';
import { GroupedBillingService, BillingAllocation, BillingInvoice } from '../../../core/services/grouped-billing.service';
import { GroupedBillingComponent } from './grouped-billing';
import { PatientProfileComponent } from '../../../shared/components/patient-profile/patient-profile.component';
import { billingArabic } from './billing-text';
import { CourseFinanceService } from '../../../core/services/course-finance.service';
import { ReceptionWarnings } from '../../../core/services/reception-warnings';

@Component({
  selector: "p-dropdown",
  standalone: true,
  imports: [ReceptionistTextPipe, CommonModule, FormsModule, SelectModule],
  template: `
    <p-select 
      [options]="options" [disabled]="disabled"
      [(ngModel)]="value" 
      (ngModelChange)="onValueChange($event)"
      [placeholder]="placeholder"
      [appendTo]="appendTo"
      [styleClass]="styleClass">
      <ng-template pTemplate="item" let-method>{{ method | receptionistText }}</ng-template>
      <ng-template pTemplate="selectedItem" let-method>{{ method | receptionistText }}</ng-template>
    </p-select>
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DropdownComponent),
      multi: true
    }
  ]
})
export class DropdownComponent implements ControlValueAccessor {
  @Input() options: any[] = [];
  @Input() placeholder: string = '';
  @Input() appendTo: any = 'body';
  @Input() disabled = false;
  @Input() styleClass: string = 'w-100 p-select-sm';

  value: any = null;
  onChange: any = () => {};
  onTouched: any = () => {};

  writeValue(val: any): void {
    this.value = val;
  }
  registerOnChange(fn: any): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }
  onValueChange(val: any): void {
    this.value = val;
    this.onChange(val);
    this.onTouched();
  }
}

@Component({
  selector: "app-receptionist-billing",
  standalone: true,
  imports: [ReceptionistTextPipe,
    CommonModule, 
    TranslateModule, 
    FormsModule, 
    TableModule, 
    TagModule, 
    ButtonModule,
    DialogModule,
    SelectModule,
    InputNumberModule,
    TabsModule,
    DropdownComponent, GroupedBillingComponent, PatientProfileComponent
  ],
  templateUrl: "./billing.html",
  styleUrl: "./billing.css"
})
export class BillingComponent implements OnInit {
  @ViewChild(GroupedBillingComponent) grouped?: GroupedBillingComponent;
  readonly groupedApi = inject(GroupedBillingService);
  readonly allocation = signal<BillingAllocation | null>(null);
  readonly allocationLoading = signal(false);
  readonly savedAllocation = signal<BillingAllocation | null>(null);
  async reviewAllocation() {
    if(!this.selectedAccountKey || this.allocationLoading())return;
    this.allocationLoading.set(true);this.paymentError.set('');
    const key=this.selectedAccountKey,amount=this.amountToCollect;
    try { const allocation=await firstValueFrom(this.groupedApi.allocation(key,amount));if(this.selectedAccountKey===key && this.amountToCollect===amount)this.allocation.set(allocation); }
    catch(error) {this.paymentError.set(apiError(error));this.allocation.set(null);}
    finally {this.allocationLoading.set(false);}
  }
  get allocationReady() { return !!this.allocation() && this.allocation()?.accountKey===this.selectedAccountKey && this.allocation()?.amount===this.amountToCollect; }
  detailInvoice = signal<Invoice | null>(null);
  detailContext = signal<BillingInvoice | null>(null);
  collectionView = true;
  profilePatientId: string | null = null;
  billingText(text: string) { return this.locale.language === 'ar-EG' ? billingArabic[text] ?? this.locale.label(text) : text; }
  get collectionLocked() { return this.isSubmittingPayment() || this.billingService.mutation.uncertain() || this.billingService.unresolvedInvoicePaymentIds.length>0 || !!this.bookingApi.pendingCollection() || this.finance.pendingPatients().length>0; }
  async openInvoice(id: number, collect: boolean) {
    if(this.invoiceDetailLoading() || this.isSubmittingPayment())return;
    this.invoiceDetailLoading.set(true);this.paymentError.set('');
    try {
      const [invoice,context]=await Promise.all([firstValueFrom(this.billingService.getInvoiceById(id)),firstValueFrom(this.groupedApi.context(id))]);
      if(collect && context.pricingMode==='Package' && context.agreementId && !context.collectionBlockedReason && !this.collectionLocked) {
        // Package receipts cover the course, including balances spread over several invoices.
        this.bookingApi.invalidatePatient(context.patientId);
        const patient=await firstValueFrom(this.bookingApi.context(context.patientId));
        const financial=patient.plans.find(p=>p.id===context.planId)?.financial;
        if(!financial || financial.agreementId!==context.agreementId)throw new Error(this.billingText('Account unavailable'));
        this.openAccountPayment({key:`course:${financial.agreementId}`,remainingAmount:financial.remainingAmount});this.detailContext.set(context);return;
      }
      this.detailInvoice.set(invoice);this.detailContext.set(context);
      this.openPaymentModal(id);
      this.collectionView=collect && (invoice.remainingAmount ?? 0)>0 && !['Waived','Cancelled'].includes(this.billingService.mapStatusToString(invoice.status)) && !this.collectionLocked;
    } catch(error) { this.paymentError.set(apiError(error)); }
    finally { this.invoiceDetailLoading.set(false); }
  }
  refreshGrouped() { this.grouped?.refresh(); }
  activeTab: string | number | undefined = '0';
  readonly locale = new ReceptionistLocale();
  billingService = inject(BillingService, { optional: true }) ?? new BillingService();
  patientService = inject(PatientService, { optional: true });
  messageService = inject(MessageService);
  private warnings = inject(ReceptionWarnings);
  readonly bookingApi = inject(BookingService);
  readonly finance = inject(CourseFinanceService);
  readonly accounts = signal<BookingAccount[]>([]);
  readonly accountsError = signal('');
  readonly accountsLoading = signal(false);
  readonly accountsLoaded = signal(false);
  readonly patientLookupError = signal('');
  selectedAccountKey: string | null = null;
  refreshAccounts() {
    if(String(this.activeTab)!=='1'){this.accountsLoaded.set(false);return;}
    this.accountsError.set(''); this.accountsLoading.set(true);
    this.bookingApi.accounts().subscribe({ next: accounts => {this.accounts.set(accounts);this.accountsLoaded.set(true);this.accountsLoading.set(false);}, error: error => {this.accountsLoaded.set(false);this.accountsError.set(apiError(error));this.accountsLoading.set(false);} });
  }
  openAccountPayment(account: BookingAccount | Pick<BookingAccount,'key'|'remainingAmount'>) {
    if (this.isSubmittingPayment()) return;
    this.collectionView=true;this.detailInvoice.set(null);this.detailContext.set(null);this.allocation.set(null);
    this.selectedAccountKey = account.key; this.selectedInvoiceId = null;
    this.amountToCollect = account.remainingAmount; this.selectedPaymentMethod = ''; this.invoicePayments.set([]);
    const original=this.bookingApi.pendingCollection();
    if(original?.accountKey===account.key && original.amount!==undefined){this.amountToCollect=original.amount;this.selectedPaymentMethod=original.method ?? '';}
    this.paymentError.set(''); this.showPaymentModal = true;
  }
  async reconcileCollection() {
    if (this.isSubmittingPayment()) return;
    this.isSubmittingPayment.set(true);
    try { await firstValueFrom(this.bookingApi.reconcileCollection()); this.paymentError.set(''); this.showPaymentModal=false;this.selectedAccountKey=null;this.refreshAccounts(); this.refreshGrouped(); }
    catch { this.paymentError.set(this.locale.text('COLLECTION_NOT_CONFIRMED', 'No committed collection has been confirmed. Retry only the original collection with the same key.')); }
    finally { this.isSubmittingPayment.set(false); }
  }

  // Modal State
  showPaymentModal = false;
  selectedInvoiceId: number | string | null = null;
  selectedPaymentMethod = '';
  readonly paymentError = signal('');
  readonly paymentHistoryError = signal('');
  readonly paymentHistoryLoading = signal(false);
  readonly invoiceDetailLoading = signal(false);
  amountToCollect: number = 0;
  // PrimeNG's currency parser splits affixes on the Latin digit "1" and treats
  // the dots in the Arabic EGP symbol as currency characters. Use Latin input
  // digits and the ISO currency code so blur preserves the exact decimal value.
  get collectionInputLocale() { return `${this.locale.language}-u-nu-latn`; }
  get paymentMethods() { return this.billingService.paymentMethods.filter(method => method !== 'Insurance'); }
  invoicePayments = signal<Payment[]>([]);
  isSubmittingPayment = signal<boolean>(false);

  ngOnInit(): void {
    // The account history is loaded when its tab is opened; the cashier reads grouped invoices.
  }
  billingTabChanged(value:string|number|undefined) { this.activeTab=value;if(String(value)==='1'&&!this.accountsLoading())this.refreshAccounts(); }
  refreshPatientLookup() {
    this.patientLookupError.set('');
    this.patientService?.getPatients().subscribe({error:e=>this.patientLookupError.set(apiError(e))});
  }

  isProcessingPayment = computed(
    () => this.isSubmittingPayment() || this.billingService.loading()
  );

  // Strictly bound to BillingService signals
  invoices = computed<Invoice[]>(() => this.billingService.invoices());
  patients = computed(() => this.patientService?.patients() ?? []);

  // Tab Computed Signals (strictly using totalAmount, patientAmount, insuranceAmount and enum mapping helpers)
  dailyCashierInvoices = computed(() => this.invoices());
  pendingInstallments = computed(() => this.accounts().filter(account => account.remainingAmount > 0 && account.installments.length > 0));

  insuranceClaims = computed(() =>
    this.invoices().filter((inv) => (inv.insuranceAmount || 0) > 0)
  );

  // Centralized Financial Signals strictly from BillingService
  expectedTodayRevenue = this.billingService.expectedTodayRevenue;
  collectedTodayRevenue = this.billingService.collectedTodayRevenue;
  pendingTodayRevenue = this.billingService.pendingTodayRevenue;
  cashCollectedToday = this.billingService.cashCollectedToday;
  digitalCollectedToday = this.billingService.digitalCollectedToday;
  collectionRateToday = this.billingService.collectionRateToday;

  // Real-time computed summary signals for KPI metrics (strictly using totalAmount / patientAmount)
  totalRevenue = computed(() => this.invoices().reduce((sum, invoice) => sum + (invoice.paidAmount ?? 0), 0));
  cashPayments = computed<number|null>(() => null);
  onlinePayments = computed<number|null>(() => null);
  pendingPaymentsTotal = computed(() => this.invoices().reduce((sum,invoice) => sum + (invoice.remainingAmount ?? 0),0));

  /**
   * Opens the payment modal for the chosen invoice.
   * Pre-fills amountToCollect with remainingBalance or patientAmount.
   */
  openPaymentModal(invoiceId: number | string) {
    if(this.isSubmittingPayment()) return;
    this.collectionView=true;
    this.selectedInvoiceId = invoiceId;
    this.selectedAccountKey = null;
    this.selectedPaymentMethod = '';
    this.paymentError.set(''); this.invoicePayments.set([]);
    this.amountToCollect = this.billingService.findInvoiceById(invoiceId)?.remainingAmount ?? 0;
    const original=this.billingService.paymentIntent(Number(invoiceId));
    if(original){this.amountToCollect=original.amount;this.selectedPaymentMethod=this.billingService.mapMethodToString(original.method);}
    this.showPaymentModal = true;
    this.detailInvoice.set(this.billingService.findInvoiceById(invoiceId) ?? null);
    this.loadPaymentHistory();
  }
  loadPaymentHistory() {
    if(this.selectedInvoiceId===null)return;
    const id=Number(this.selectedInvoiceId), recovering=!!this.billingService.paymentIntent(id);
    this.paymentHistoryLoading.set(true);this.paymentHistoryError.set('');
    this.billingService.getPaymentsForInvoice(id).subscribe({
      next:payments=>{
        if(Number(this.selectedInvoiceId)!==id)return;
        this.invoicePayments.set(payments);
        const reconciled=recovering && !this.billingService.paymentIntent(id);
        if(reconciled){
          // The original receipt is confirmed. Do not leave its amount ready as
          // a new collection while the invoice balance is being refreshed.
          this.collectionView=false;this.amountToCollect=0;this.selectedPaymentMethod='';
          this.detailInvoice.set(null);this.refreshGrouped();this.refreshAccounts();
        }
        if(reconciled || (!this.collectionView && !this.detailInvoice())){
          this.billingService.getInvoiceById(id).subscribe({
            next:invoice=>{if(Number(this.selectedInvoiceId)!==id)return;this.detailInvoice.set(invoice);this.paymentHistoryLoading.set(false);},
            error:error=>{if(Number(this.selectedInvoiceId)!==id)return;this.paymentHistoryError.set(apiError(error));this.paymentHistoryLoading.set(false);}
          });
        }else this.paymentHistoryLoading.set(false);
      },
      error:error=>{if(Number(this.selectedInvoiceId)!==id)return;this.paymentHistoryError.set(apiError(error));this.paymentHistoryLoading.set(false);}
    });
  }
  /**
   * Action trigger from table - opens the payment method modal
   */
  payInvoice(invoiceId: number | string) {
    this.openPaymentModal(invoiceId);
  }

  /**
   * Confirms manual payment via BillingService.recordPayment()
   */
  get collectionDetailsLocked() {
    return this.isSubmittingPayment() || (this.selectedAccountKey ? this.bookingApi.pendingCollection()?.accountKey===this.selectedAccountKey : !!this.billingService.paymentIntent(Number(this.selectedInvoiceId)));
  }
  async confirmPayment(): Promise<void> {
    if (this.selectedAccountKey) {
      if (this.isSubmittingPayment()) return;
      this.isSubmittingPayment.set(true); this.paymentError.set('');
      try {
        if (!this.paymentMethods.includes(this.selectedPaymentMethod)) throw new Error(this.locale.text('PAYMENT_METHOD_REQUIRED', 'Select the actual patient payment method.'));
        if(!this.allocationReady && !this.bookingApi.pendingCollection())throw new Error(this.billingText('Review allocation'));
        await firstValueFrom(this.bookingApi.collectAccount(this.selectedAccountKey, this.amountToCollect, this.selectedPaymentMethod as BookingPaymentMethod, this.allocation()?.hash));
        this.savedAllocation.set(this.allocation());
        this.showPaymentModal = false; this.selectedAccountKey = null; this.refreshAccounts(); this.refreshGrouped();
      } catch (error) { if(!this.bookingApi.pendingCollection())this.allocation.set(null);this.paymentError.set(this.bookingApi.pendingCollection() ? this.locale.text('COLLECTION_OUTCOME_UNKNOWN', 'The collection outcome is unknown. Reconcile it before collecting again.') : apiError(error)); }
      finally { this.isSubmittingPayment.set(false); }
      return;
    }
    if (this.selectedInvoiceId === null || this.isSubmittingPayment()) return;
    this.isSubmittingPayment.set(true);this.paymentError.set('');
    const amount=this.amountToCollect, id=Number(this.selectedInvoiceId), method=this.selectedPaymentMethod;
    try {
      // Re-read the invoice before collection. The server remains responsible for atomic balance enforcement.
      const invoice=await firstValueFrom(this.billingService.getInvoiceById(id));
      if(!Number.isFinite(amount)||amount<=0||amount>(invoice.remainingAmount??0))throw new ReceptionError('PAYMENT_AMOUNT_INVALID','Enter a positive payment no greater than the saved invoice balance.');
      await firstValueFrom(this.billingService.recordPayment({invoiceId:id,amount,method:this.billingService.mapPaymentMethodToNumber(method),expectedRemaining:this.detailInvoice()?.id===id ? this.detailInvoice()?.remainingAmount : invoice.remainingAmount}));
    } catch(error) {
      this.paymentError.set(error instanceof ReceptionError?this.locale.text(error.key,error.message):apiError(error));
      this.warnings.show(this.paymentError());
      this.isSubmittingPayment.set(false);return;
    }
    this.isSubmittingPayment.set(false);
    this.showPaymentModal=false;this.selectedInvoiceId=null;this.amountToCollect=0;
    this.messageService.add({severity:'success',summary:this.locale.text('PAYMENT_RECORDED','Payment Recorded'),detail:this.locale.text('PAYMENT_SAVED_REFRESH_SEPARATE','Payment saved. Verify the refreshed balance before collecting again.')});
    this.refreshGrouped();
    this.refreshAccounts();
  }

  async updateInvoiceStatus(invoiceId: number|string, status: string|number) {
    if(this.billingService.mutation.busy())return;
    try { await firstValueFrom(this.billingService.updateInvoiceStatus(Number(invoiceId),this.billingService.mapStatusToNumber(status))); }
    catch(error){this.paymentError.set(apiError(error));return;}
    this.refreshGrouped();
  }
  async deleteInvoice(invoiceId: number|string) {
    if(this.billingService.mutation.busy())return;
    try { await firstValueFrom(this.billingService.deleteInvoice(Number(invoiceId))); }
    catch(error){this.paymentError.set(apiError(error));return;}
    this.refreshGrouped();
  }

  /**
   * Helper mapping invoice status (number or string) to PrimeNG tag severity:
   * - Paid    -> 'success' (Green)
   * - Pending -> 'warn'    (Orange / Warning)
   * - Partial -> 'info'    (Blue)
   * - Waived  -> 'secondary'
   */
  getStatusSeverity(status: string | number): 'success' | 'warn' | 'info' | 'secondary' {
    const statusStr =
      typeof status === 'string' &&
      !['Paid', 'Pending', 'Partial', 'Waived', 'Refunded', '0', '1', '2', '3', '4'].includes(status)
        ? status
        : this.billingService.mapStatusToString(status);
    switch (statusStr) {
      case 'Paid':
        return 'success';
      case 'Pending':
        return 'warn';
      case 'Partial':
        return 'info';
      default:
        return 'secondary';
    }
  }

  getPatientName(patientId: string | number, fallbackName?: string): string {
    const idStr = patientId != null ? patientId.toString() : '';
    const p = this.patients().find((p) => p.id === idStr);
    return this.locale.patientName(p) || fallbackName || this.locale.label('Unknown Patient');
  }
}
