import { Component, signal, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { ClinicStateService } from '../../../core/services/state/clinic-state.service';
import { MessageService } from 'primeng/api';

@Component({
  selector: "app-receptionist-insurance",
  standalone: true,
  imports: [CommonModule, TranslateModule, FormsModule],
  templateUrl: "./insurance.html"
})
export class InsuranceComponent {
  clinicState = inject(ClinicStateService);
  messageService = inject(MessageService);
  
  patients = this.clinicState.claims;
  isProcessing = this.clinicState.isLoading;
  allPatients = this.clinicState.patients;

  showDrawer = signal(false);
  selectedPatient: any = null;

  copayInput = 0;
  insuranceCompany = '';
  activeDrawerTab = 'docs'; // 'docs' or 'copay'
  package = '';
  copayValue = 0;

  getPatient(id: string) {
    return this.allPatients().find(p => p.id === id);
  }

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
    await this.clinicState.submitClaim(this.selectedPatient.id);
    this.closeDrawer();
    this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Claim submitted successfully' });
  }

  async saveCopay() {
    if (this.selectedPatient) {
      await this.clinicState.saveCopay(this.selectedPatient.id, this.copayInput);
    }
    this.closeDrawer();
    this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Copay updated' });
  }
}
