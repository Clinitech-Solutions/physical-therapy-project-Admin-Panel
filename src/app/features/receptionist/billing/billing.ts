import { Component, OnInit, computed, inject, signal, Input, forwardRef } from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { CommonModule } from "@angular/common";
import { TranslateModule } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { BillingService, Invoice, Payment } from '../../../core/services/billing.service';
import { AppointmentService } from '../../../core/services/appointment.service';
import { MessageService } from 'primeng/api';
import { PatientService } from '../../../core/services/patient.service';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { ProgressBar } from 'primeng/progressbar';
import { TabsModule } from 'primeng/tabs';

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
    InputNumberModule,
    ProgressBar,
    TabsModule,
    DropdownComponent
  ],
  templateUrl: "./billing.html",
  styleUrl: "./billing.css"
})
export class BillingComponent implements OnInit {
  billingService = inject(BillingService, { optional: true }) ?? new BillingService();
  patientService = inject(PatientService, { optional: true });
  appointmentService = inject(AppointmentService, { optional: true });
  messageService = inject(MessageService);

  // Modal State
  showPaymentModal = false;
  selectedInvoiceId: number | string | null = null;
  selectedPaymentMethod = 'Cash';
  amountToCollect: number = 0;
  paymentMethods = ['Cash', 'Credit Card', 'E-Wallet', 'InstaPay'];
  invoicePayments = signal<Payment[]>([]);
  isSubmittingPayment = signal<boolean>(false);

  // Installment Modal State
  showInstallmentModal = false;
  installmentPatientId: string | null = null;
  installmentAmount: number = 0;
  installmentPaymentMethod = 'Cash';
  selectedPatientRemainingDebt: number = 0;

  ngOnInit(): void {
    this.billingService.getInvoices();
    this.patientService?.getPatients().subscribe();
    this.appointmentService?.getAppointments();
  }

  isProcessingPayment = computed(
    () => this.isSubmittingPayment() || this.billingService.loading()
  );

  // Strictly bound to BillingService signals
  invoices = computed<Invoice[]>(() => this.billingService.invoices());
  patients = computed(() => this.patientService?.patients() ?? []);

  // Tab Computed Signals (strictly using totalAmount, patientAmount, insuranceAmount and enum mapping helpers)
  dailyCashierInvoices = computed(() =>
    this.invoices().filter((inv) => {
      const isToday =
        !inv.createdAt ||
        new Date(inv.createdAt).toDateString() === new Date().toDateString();
      const hasPatientAmount = (inv.patientAmount || 0) > 0;
      const statusStr = this.billingService.mapStatusToString(inv.status);
      const typeStr = this.billingService.mapTypeToString(inv.type);
      const isPaidOrPartialOrPending =
        statusStr === 'Paid' || statusStr === 'Partial' || statusStr === 'Pending';
      return isToday && hasPatientAmount && isPaidOrPartialOrPending && typeStr !== 'Installment';
    })
  );

  pendingInstallments = computed(() =>
    this.patients().filter((p) => {
      const plan = p.financialPlan ?? p.treatmentPlan?.financialPlan;
      return plan && (plan.remainingDebt ?? 0) > 0;
    })
  );

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
  totalRevenue = computed(() =>
    this.invoices()
      .filter((inv) => this.billingService.mapStatusToString(inv.status) === 'Paid')
      .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0)
  );

  cashPayments = computed(() =>
    this.invoices()
      .filter((inv) => {
        const isPaid = this.billingService.mapStatusToString(inv.status) === 'Paid';
        const methodStr = this.billingService.mapMethodToString(inv.paymentMethod);
        const typeStr = this.billingService.mapTypeToString(inv.type);
        return isPaid && (methodStr === 'Cash' || (!inv.paymentMethod && typeStr === 'Session'));
      })
      .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0)
  );

  onlinePayments = computed(() =>
    this.invoices()
      .filter((inv) => {
        const isPaid = this.billingService.mapStatusToString(inv.status) === 'Paid';
        const methodStr = inv.paymentMethod
          ? this.billingService.mapMethodToString(inv.paymentMethod)
          : '';
        return isPaid && Boolean(methodStr) && methodStr !== 'Cash';
      })
      .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0)
  );

  pendingPaymentsTotal = computed(() =>
    this.invoices()
      .filter((inv) => this.billingService.mapStatusToString(inv.status) === 'Pending')
      .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0)
  );

  /**
   * Opens the payment modal for the chosen invoice.
   * Pre-fills amountToCollect with remainingBalance or patientAmount.
   */
  openPaymentModal(invoiceId: number | string) {
    this.selectedInvoiceId = invoiceId;
    this.selectedPaymentMethod = 'Cash';
    this.invoicePayments.set([]);

    const invoice = this.billingService.findInvoiceById(invoiceId);
    this.amountToCollect =
      invoice?.remainingBalance ?? invoice?.patientAmount ?? invoice?.totalAmount ?? 0;

    if (!isNaN(Number(invoiceId))) {
      this.billingService.getPaymentsForInvoice(Number(invoiceId)).subscribe({
        next: (payments) => this.invoicePayments.set(payments),
        error: () => this.invoicePayments.set([])
      });
    }

    this.showPaymentModal = true;
  }

  openInstallmentModal(patientId: string | number) {
    this.installmentPatientId = patientId.toString();
    this.installmentPaymentMethod = 'Cash';

    const patient = this.patients().find((p) => p.id === patientId.toString());
    const plan = patient?.financialPlan ?? patient?.treatmentPlan?.financialPlan;
    this.selectedPatientRemainingDebt = plan?.remainingDebt ?? 0;
    this.installmentAmount = this.selectedPatientRemainingDebt;

    this.showInstallmentModal = true;
  }

  async confirmInstallmentCollection() {
    if (!this.installmentPatientId) return;

    if (!this.installmentAmount || this.installmentAmount <= 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Invalid Amount',
        detail: 'Please enter a valid amount.'
      });
      return;
    }

    this.isSubmittingPayment.set(true);
    try {
      const numericPatientId = Number(this.installmentPatientId);
      const methodNum = this.billingService.mapPaymentMethodToNumber(
        this.installmentPaymentMethod
      );

      const existingPendingInvoice = this.billingService
        .invoices()
        .find((inv) => {
          const st = this.billingService.mapStatusToString(inv.status);
          return (
            Number(inv.patientId) === numericPatientId &&
            (st === 'Pending' || st === 'Partial')
          );
        });

      if (existingPendingInvoice?.id) {
        await firstValueFrom(
          this.billingService.recordPayment({
            invoiceId: Number(existingPendingInvoice.id),
            amount: this.installmentAmount,
            method: methodNum
          })
        );
      } else {
        const patientAppts = (this.appointmentService?.appointments() ?? []).filter(
          (a) => Number(a.patientId) === numericPatientId
        );
        const latestApptId =
          patientAppts.length > 0 ? Number(patientAppts[0].id || 0) : 0;

        const createdInv = await firstValueFrom(
          this.billingService.createInvoice({
            appointmentId: latestApptId,
            patientId: numericPatientId,
            type: this.billingService.mapTypeToNumber('Installment'),
            totalAmount: this.installmentAmount,
            insuranceAmount: 0,
            patientAmount: this.installmentAmount
          })
        );

        if (createdInv?.id) {
          await firstValueFrom(
            this.billingService.recordPayment({
              invoiceId: Number(createdInv.id),
              amount: this.installmentAmount,
              method: methodNum
            })
          );
        }
      }

      // Update patient's financial plan in PatientService signal
      if (this.patientService) {
        this.patientService.patients.update((list) =>
          list.map((p) => {
            if (p.id !== this.installmentPatientId) return p;
            const plan = p.financialPlan ?? p.treatmentPlan?.financialPlan;
            if (!plan) return p;
            const updatedPlan = {
              ...plan,
              totalPaidSoFar: (plan.totalPaidSoFar ?? 0) + this.installmentAmount,
              remainingDebt: Math.max(0, (plan.remainingDebt ?? 0) - this.installmentAmount)
            };
            return p.financialPlan
              ? { ...p, financialPlan: updatedPlan }
              : {
                  ...p,
                  treatmentPlan: { ...p.treatmentPlan!, financialPlan: updatedPlan }
                };
          })
        );
      }

      this.showInstallmentModal = false;
      this.installmentPatientId = null;
      this.installmentAmount = 0;
      this.messageService.add({
        severity: 'success',
        summary: 'Installment Collected',
        detail: `Installment payment recorded successfully.`
      });
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: error?.message || 'Payment processing failed'
      });
    } finally {
      this.isSubmittingPayment.set(false);
    }
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
  async confirmPayment(): Promise<void> {
    if (this.selectedInvoiceId === null) return;

    if (!this.amountToCollect || this.amountToCollect <= 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Invalid Amount',
        detail: 'Please enter a valid amount to collect.'
      });
      return;
    }

    this.isSubmittingPayment.set(true);
    try {
      const collected = this.amountToCollect;
      const method = this.selectedPaymentMethod;
      const numericInvoiceId = Number(this.selectedInvoiceId);

      await firstValueFrom(
        this.billingService.recordPayment({
          invoiceId: numericInvoiceId,
          amount: collected,
          method: this.billingService.mapPaymentMethodToNumber(method)
        })
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
    } finally {
      this.isSubmittingPayment.set(false);
    }
  }

  updateInvoiceStatus(invoiceId: number | string, status: string | number): void {
    const numericId = Number(invoiceId);
    if (isNaN(numericId)) return;
    const statusNum = this.billingService.mapStatusToNumber(status);
    this.billingService.updateInvoiceStatus(numericId, statusNum).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Status Updated',
          detail: 'Invoice status updated successfully.'
        });
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Update Failed',
          detail: err?.message || 'Failed to update invoice status.'
        });
      }
    });
  }

  deleteInvoice(invoiceId: number | string): void {
    const numericId = Number(invoiceId);
    if (isNaN(numericId)) return;
    this.billingService.deleteInvoice(numericId).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Invoice Deleted',
          detail: 'Invoice removed successfully.'
        });
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Delete Failed',
          detail: err?.message || 'Failed to delete invoice.'
        });
      }
    });
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
    if (fallbackName) return fallbackName;
    const idStr = patientId != null ? patientId.toString() : '';
    const p = this.patients().find((p) => p.id === idStr);
    return p ? p.nameEn || p.nameAr || 'Unknown Patient' : 'Unknown Patient';
  }
}
