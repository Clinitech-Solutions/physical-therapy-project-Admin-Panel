import { apiError, localDay, ReceptionError } from '../../../core/services/reception-api';
import { ReceptionistLocale, ReceptionistTextPipe } from '../../../shared/receptionist-locale';
import { Component, OnInit, computed, inject, signal, Input, forwardRef } from "@angular/core";
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
import { CourseFinanceService } from '../../../core/services/course-finance.service';

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
    DropdownComponent
  ],
  templateUrl: "./billing.html",
  styleUrl: "./billing.css"
})
export class BillingComponent implements OnInit {
  activeTab: string | number | undefined = '0';
  readonly locale = new ReceptionistLocale();
  billingService = inject(BillingService, { optional: true }) ?? new BillingService();
  patientService = inject(PatientService, { optional: true });
  messageService = inject(MessageService);
  readonly bookingApi = inject(BookingService);
  readonly finance = inject(CourseFinanceService);
  readonly accounts = signal<BookingAccount[]>([]);
  readonly accountsError = signal('');
  readonly accountsLoading = signal(false);
  readonly patientLookupError = signal('');
  selectedAccountKey: string | null = null;
  refreshAccounts() {
    this.accountsError.set(''); this.accountsLoading.set(true);
    this.bookingApi.accounts().subscribe({ next: accounts => {this.accounts.set(accounts);this.accountsLoading.set(false);}, error: error => {this.accountsError.set(apiError(error));this.accountsLoading.set(false);} });
  }
  openAccountPayment(account: BookingAccount) {
    if (this.isSubmittingPayment()) return;
    this.selectedAccountKey = account.key; this.selectedInvoiceId = null;
    this.amountToCollect = account.remainingAmount; this.selectedPaymentMethod = ''; this.invoicePayments.set([]);
    const original=this.bookingApi.pendingCollection();
    if(original?.accountKey===account.key && original.amount!==undefined){this.amountToCollect=original.amount;this.selectedPaymentMethod=original.method ?? '';}
    this.paymentError.set(''); this.showPaymentModal = true;
  }
  async reconcileCollection() {
    if (this.isSubmittingPayment()) return;
    this.isSubmittingPayment.set(true);
    try { await firstValueFrom(this.bookingApi.reconcileCollection()); this.paymentError.set(''); this.showPaymentModal=false;this.selectedAccountKey=null;this.refreshAccounts(); this.billingService.getInvoices(); }
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
    this.refreshAccounts();
    this.billingService.getInvoices();
    this.refreshPatientLookup();
  }
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
    this.selectedInvoiceId = invoiceId;
    this.selectedAccountKey = null;
    this.selectedPaymentMethod = '';
    this.paymentError.set(''); this.invoicePayments.set([]);
    this.amountToCollect = this.billingService.findInvoiceById(invoiceId)?.remainingAmount ?? 0;
    const original=this.billingService.paymentIntent(Number(invoiceId));
    if(original){this.amountToCollect=original.amount;this.selectedPaymentMethod=this.billingService.mapMethodToString(original.method);}
    this.showPaymentModal = true;
    this.loadPaymentHistory();
  }
  loadPaymentHistory() {
    if(this.selectedInvoiceId===null)return;
    const id=Number(this.selectedInvoiceId);
    this.paymentHistoryLoading.set(true);this.paymentHistoryError.set('');
    this.billingService.getPaymentsForInvoice(id).subscribe({
      next:payments=>{if(Number(this.selectedInvoiceId)!==id)return;this.invoicePayments.set(payments);this.paymentHistoryLoading.set(false);},
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
        await firstValueFrom(this.bookingApi.collectAccount(this.selectedAccountKey, this.amountToCollect, this.selectedPaymentMethod as BookingPaymentMethod));
        this.showPaymentModal = false; this.selectedAccountKey = null; this.refreshAccounts(); this.billingService.getInvoices();
      } catch (error) { this.paymentError.set(this.bookingApi.pendingCollection() ? this.locale.text('COLLECTION_OUTCOME_UNKNOWN', 'The collection outcome is unknown. Reconcile it before collecting again.') : apiError(error)); }
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
      await firstValueFrom(this.billingService.recordPayment({invoiceId:id,amount,method:this.billingService.mapPaymentMethodToNumber(method)}));
    } catch(error) {
      this.paymentError.set(error instanceof ReceptionError?this.locale.text(error.key,error.message):apiError(error));
      this.isSubmittingPayment.set(false);return;
    }
    this.isSubmittingPayment.set(false);
    this.showPaymentModal=false;this.selectedInvoiceId=null;this.amountToCollect=0;
    this.messageService.add({severity:'success',summary:this.locale.text('PAYMENT_RECORDED','Payment Recorded'),detail:this.locale.text('PAYMENT_SAVED_REFRESH_SEPARATE','Payment saved. Verify the refreshed balance before collecting again.')});
    this.billingService.getInvoices();
    this.refreshAccounts();
  }

  async updateInvoiceStatus(invoiceId: number|string, status: string|number) {
    if(this.billingService.mutation.busy())return;
    try { await firstValueFrom(this.billingService.updateInvoiceStatus(Number(invoiceId),this.billingService.mapStatusToNumber(status))); }
    catch(error){this.paymentError.set(apiError(error));return;}
    this.billingService.getInvoices();
  }
  async deleteInvoice(invoiceId: number|string) {
    if(this.billingService.mutation.busy())return;
    try { await firstValueFrom(this.billingService.deleteInvoice(Number(invoiceId))); }
    catch(error){this.paymentError.set(apiError(error));return;}
    this.billingService.getInvoices();
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
