import { Component, signal, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { InsuranceService } from '../../../core/services/api/insurance.service';
import { MessageService } from 'primeng/api';

@Component({
  selector: "app-receptionist-insurance",
  standalone: true,
  imports: [CommonModule, TranslateModule, FormsModule],
  templateUrl: "./insurance.html"
})
export class InsuranceComponent {
  insuranceService = inject(InsuranceService);
  messageService = inject(MessageService);
  patients = this.insuranceService.claims;
  isProcessing = this.insuranceService.processing;

  showDrawer = signal(false);
  selectedPatient: any = null;

  copayInput = 0;
  insuranceCompany = '';
  activeDrawerTab = 'docs'; // 'docs' or 'copay'
  package = '';
  copayValue = 0;

  openDrawer(patient: any) {
    this.selectedPatient = patient;
    this.copayInput = patient.copay || 0;
    this.insuranceCompany = patient.company;
    this.showDrawer.set(true);
  }

  closeDrawer() {
    this.showDrawer.set(false);
    this.selectedPatient = null;
  }

  async submitToInsurer() {
    if (!this.selectedPatient) return;
    await this.insuranceService.submitClaim(this.selectedPatient.id);
    this.closeDrawer();
    this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Claim submitted successfully' });
  }

  async saveCopay() {
    if (this.selectedPatient) {
      await this.insuranceService.saveCopay(this.selectedPatient.id, this.copayInput);
    }
    this.closeDrawer();
    this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Copay updated' });
  }
}
