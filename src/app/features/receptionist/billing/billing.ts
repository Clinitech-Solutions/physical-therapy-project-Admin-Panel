import { Component, signal, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { PatientService } from '../../../core/services/api/patient.service';
import { BillingService } from '../../../core/services/api/billing.service';
import { MessageService } from 'primeng/api';

@Component({
  selector: "app-receptionist-billing",
  standalone: true,
  imports: [CommonModule, TranslateModule, FormsModule],
  templateUrl: "./billing.html"
})
export class BillingComponent {
  billingService = inject(BillingService);
  patientService = inject(PatientService);
  messageService = inject(MessageService);
  
  invoices = this.billingService.invoices;
  isProcessing = this.billingService.processingPayment;
  allPatients = this.patientService.patients;

  showDrawer = signal(false);
  selectedInvoice: any = null;

  paymentMethod = 'Cash';
  amountCollected = 0;

  getPatient(id: string) {
    return this.allPatients().find(p => p.id === id);
  }

  formatDate(isoString: string) {
    try {
      return new Date(isoString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return isoString;
    }
  }

  openDrawer(invoice: any) {
    this.selectedInvoice = invoice;
    this.amountCollected = invoice.amount;
    this.showDrawer.set(true);
  }

  closeDrawer() {
    this.showDrawer.set(false);
    this.selectedInvoice = null;
  }

  async processPayment() {
    if (!this.selectedInvoice) return;
    await this.billingService.processPayment(this.selectedInvoice.id);
    this.closeDrawer();
    this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Payment processed successfully' });
  }
}
