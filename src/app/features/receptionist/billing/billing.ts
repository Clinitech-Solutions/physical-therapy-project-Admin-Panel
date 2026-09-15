import { Component, computed, inject, Input, forwardRef } from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { CommonModule } from "@angular/common";
import { TranslateModule } from '@ngx-translate/core';
import { ClinicStateService } from '../../../core/services/state/clinic-state.service';
import { MessageService } from 'primeng/api';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';

@Component({
  selector: "p-dropdown",
  standalone: true,
  imports: [CommonModule, FormsModule, SelectModule],
  template: `
    <p-select 
      [options]="options" 
      [(ngModel)]="value" 
      (ngModelChange)="onValueChange($event)"
      [placeholder]="placeholder"
      [appendTo]="appendTo"
      [styleClass]="styleClass">
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

import { InputNumberModule } from 'primeng/inputnumber';
import { ProgressBar } from 'primeng/progressbar';

@Component({
  selector: "app-receptionist-billing",
  standalone: true,
  imports: [
    CommonModule, 
    TranslateModule, 
    FormsModule, 
    TableModule, 
    TagModule, 
    ButtonModule,
    DialogModule,
    SelectModule,
    InputNumberModule,
    ProgressBar,
    DropdownComponent
  ],
  templateUrl: "./billing.html",
  styleUrl: "./billing.css"
})
export class BillingComponent {
  clinicState = inject(ClinicStateService);
  messageService = inject(MessageService);

  // Modal State
  showPaymentModal = false;
  selectedInvoiceId: string | null = null;
  selectedPaymentMethod = 'Cash';
  amountToCollect: number = 0;
  paymentMethods = ['Cash', 'Credit Card', 'E-Wallet', 'InstaPay'];
  
  // 100% Real-time computed signal reading strictly from ClinicStateService
  invoices = computed(() => this.clinicState.invoices());

  // Centralized Financial Signals from ClinicStateService
  expectedTodayRevenue = this.clinicState.expectedTodayRevenue;
  collectedTodayRevenue = this.clinicState.collectedTodayRevenue;
  pendingTodayRevenue = this.clinicState.pendingTodayRevenue;
  cashCollectedToday = this.clinicState.cashCollectedToday;
  digitalCollectedToday = this.clinicState.digitalCollectedToday;
  collectionRateToday = this.clinicState.collectionRateToday;

  // Real-time computed summary signals for KPI metrics (backward compatible)
  totalRevenue = computed(() =>
    this.invoices()
      .filter(inv => inv.status === 'Paid')
      .reduce((sum, inv) => sum + (inv.amount || 0), 0)
  );

  cashPayments = computed(() =>
    this.invoices()
      .filter(inv => inv.status === 'Paid' && (inv.paymentMethod === 'Cash' || (!inv.paymentMethod && inv.type === 'Session')))
      .reduce((sum, inv) => sum + (inv.amount || 0), 0)
  );

  onlinePayments = computed(() =>
    this.invoices()
      .filter(inv => inv.status === 'Paid' && inv.paymentMethod && inv.paymentMethod !== 'Cash')
      .reduce((sum, inv) => sum + (inv.amount || 0), 0)
  );

  pendingPaymentsTotal = computed(() =>
    this.invoices()
      .filter(inv => inv.status === 'Pending')
      .reduce((sum, inv) => sum + (inv.amount || 0), 0)
  );

  /**
   * Opens the payment modal for the chosen invoice.
   * Pre-fills amountToCollect with the outstanding remainingBalance (or full amount if not yet partially paid).
   */
  openPaymentModal(invoiceId: string) {
    this.selectedInvoiceId = invoiceId;
    this.selectedPaymentMethod = 'Cash';

    // Pre-fill with what is still owed
    const invoice = this.clinicState.getInvoiceById(invoiceId);
    this.amountToCollect = invoice?.remainingBalance ?? invoice?.amount ?? 0;

    this.showPaymentModal = true;
  }

  /**
   * Action trigger from table - opens the payment method modal
   */
  payInvoice(invoiceId: string) {
    this.openPaymentModal(invoiceId);
  }

  /**
   * Confirms manual payment:
   * - Validates amountToCollect > 0
   * - Calls clinicState.processPayment(invoiceId, amount, method)
   * - Closes modal and shows success/error toast
   */
  async confirmPayment(): Promise<void> {
    if (!this.selectedInvoiceId) return;

    if (!this.amountToCollect || this.amountToCollect <= 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Invalid Amount',
        detail: 'Please enter a valid amount to collect.'
      });
      return;
    }

    try {
      const collected = this.amountToCollect;
      const method    = this.selectedPaymentMethod;

      await this.clinicState.processPayment(
        this.selectedInvoiceId,
        collected,
        method
      );
      this.showPaymentModal = false;
      this.selectedInvoiceId = null;
      this.amountToCollect = 0;
      this.messageService.add({
        severity: 'success',
        summary: 'Payment Recorded',
        detail: `${collected.toLocaleString()} EGP collected via ${method}`
      });
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Payment Error',
        detail: error?.message || 'Payment processing failed'
      });
    }
  }

  /**
   * Helper mapping invoice status to PrimeNG tag severity:
   * - Paid    -> 'success' (Green)
   * - Pending -> 'warn'    (Orange / Warning)
   * - Partial -> 'info'    (Blue)
   * - Waived  -> 'secondary'
   */
  getStatusSeverity(status: string): 'success' | 'warn' | 'info' | 'secondary' {
    switch (status) {
      case 'Paid':    return 'success';
      case 'Pending': return 'warn';
      case 'Partial': return 'info';
      default:        return 'secondary';
    }
  }
}
