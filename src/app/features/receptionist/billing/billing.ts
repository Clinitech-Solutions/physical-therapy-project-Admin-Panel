import { Component, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: "app-receptionist-billing",
  standalone: true,
  imports: [CommonModule, TranslateModule, FormsModule],
  templateUrl: "./billing.html"
})
export class BillingComponent {
  invoices = signal([
    { id: 'INV-1001', patient: 'Ahmed Fathy', amount: 500, status: 'Pending', type: 'Session', date: 'Today' },
    { id: 'INV-1002', patient: 'Mona Zaki', amount: 300, status: 'Paid', type: 'Assessment', date: 'Yesterday' },
    { id: 'INV-1003', patient: 'Omar Hassan', amount: 5000, status: 'Partial', type: 'Package (10 Sessions)', date: '12 May 2026' },
  ]);

  showDrawer = signal(false);
  selectedInvoice: any = null;

  paymentMethod = 'Cash';
  amountCollected = 0;
  isProcessing = signal(false);

  openDrawer(invoice: any) {
    this.selectedInvoice = invoice;
    this.amountCollected = invoice.amount;
    this.showDrawer.set(true);
  }

  closeDrawer() {
    this.showDrawer.set(false);
    this.selectedInvoice = null;
  }

  processPayment() {
    if (!this.selectedInvoice) return;
    
    this.isProcessing.set(true);
    
    setTimeout(() => {
      this.invoices.update(invs =>
        invs.map(inv =>
          inv.id === this.selectedInvoice?.id
            ? { ...inv, status: 'Paid' }
            : inv
        )
      );
      this.isProcessing.set(false);
      this.closeDrawer();
    }, 1000);
  }
}
