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
  paymentMethods = ['Cash', 'Credit Card', 'E-Wallet'];
  
  // 100% Real-time computed signal reading strictly from ClinicStateService
  invoices = computed(() => this.clinicState.invoices());

  // Real-time computed summary signals for KPI metrics
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
   * Opens the payment method modal for the chosen invoice
   */
  openPaymentModal(invoiceId: string) {
    this.selectedInvoiceId = invoiceId;
    this.selectedPaymentMethod = 'Cash';
    this.showPaymentModal = true;
  }

  /**
   * Action trigger from table - opens the payment method modal
   */
  payInvoice(invoiceId: string) {
    this.openPaymentModal(invoiceId);
  }

  /**
   * Confirms payment with the selected payment method:
   * - Calls clinicState.processPayment(invoiceId, method)
   * - Closes the modal
   * - Shows a success toast: 'Payment processed successfully'
   */
  async confirmPayment(): Promise<void> {
    if (!this.selectedInvoiceId) return;

    try {
      await this.clinicState.processPayment(this.selectedInvoiceId, this.selectedPaymentMethod);
      this.showPaymentModal = false;
      this.selectedInvoiceId = null;
      this.messageService.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Payment processed successfully'
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
   * - Paid -> 'success' (Green)
   * - Pending -> 'warn' (Orange / Warning)
   * - Partial -> 'info' (Blue)
   */
  getStatusSeverity(status: string): 'success' | 'warn' | 'info' | 'secondary' {
    switch (status) {
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
}
