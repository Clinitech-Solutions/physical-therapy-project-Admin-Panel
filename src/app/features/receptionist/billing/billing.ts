import { Component, computed, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { ClinicStateService } from '../../../core/services/state/clinic-state.service';
import { MessageService } from 'primeng/api';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: "app-receptionist-billing",
  standalone: true,
  imports: [
    CommonModule, 
    TranslateModule, 
    FormsModule, 
    TableModule, 
    TagModule, 
    ButtonModule
  ],
  templateUrl: "./billing.html",
  styleUrl: "./billing.css"
})
export class BillingComponent {
  clinicState = inject(ClinicStateService);
  messageService = inject(MessageService);
  
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
      .filter(inv => inv.status === 'Paid' && inv.type === 'Session')
      .reduce((sum, inv) => sum + (inv.amount || 0), 0)
  );

  onlinePayments = computed(() =>
    this.invoices()
      .filter(inv => inv.status === 'Paid' && inv.type !== 'Session')
      .reduce((sum, inv) => sum + (inv.amount || 0), 0)
  );

  pendingPaymentsTotal = computed(() =>
    this.invoices()
      .filter(inv => inv.status === 'Pending')
      .reduce((sum, inv) => sum + (inv.amount || 0), 0)
  );

  /**
   * Process payment for a given invoice:
   * - Calls await clinicState.processPayment(invoiceId)
   * - Displays a success toast: 'Payment processed successfully'
   */
  async payInvoice(invoiceId: string): Promise<void> {
    try {
      await this.clinicState.processPayment(invoiceId);
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
