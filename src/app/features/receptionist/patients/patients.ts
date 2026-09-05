import { Component, signal, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';

import { PatientService } from '../../../core/services/api/patient.service';
import { Patient, NewPatient } from '../../../core/models/patient.model';
import { MessageService } from 'primeng/api';

@Component({
  selector: "app-receptionist-patients",
  standalone: true,
  imports: [CommonModule, TranslateModule, FormsModule],
  templateUrl: "./patients.html",
})
export class PatientsComponent {
  patientService = inject(PatientService);
  messageService = inject(MessageService);
  
  searchQuery = signal('');
  
  patients = this.patientService.patients;
  isLoading = this.patientService.loading;

  // Drawer state
  showDrawer = signal(false);
  
  // New Patient Form
  newPatient: NewPatient = {
    nameEn: '',
    nameAr: '',
    phone: '',
    gender: 'Male',
    dob: '',
    paymentType: 'Cash',
    insuranceCompany: '',
    docs: {
      medicalConsent: false,
      liabilityWaiver: false,
      idCard: false
    }
  };

  openDrawer() {
    this.showDrawer.set(true);
  }

  closeDrawer() {
    this.showDrawer.set(false);
  }

  async createProfile() {
    await this.patientService.createPatient(this.newPatient);
    this.closeDrawer();
    this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Patient profile created' });
  }
}
