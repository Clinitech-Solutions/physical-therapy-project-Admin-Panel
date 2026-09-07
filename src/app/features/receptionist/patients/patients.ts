import { Component, signal, computed, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';

import { ClinicStateService } from '../../../core/services/state/clinic-state.service';
import { Patient, NewPatient, PaymentMethod } from '../../../core/models/patient.model';
import { MessageService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';

@Component({
  selector: "app-receptionist-patients",
  standalone: true,
  imports: [CommonModule, TranslateModule, FormsModule, DialogModule],
  templateUrl: "./patients.html",
})
export class PatientsComponent {
  clinicState = inject(ClinicStateService);
  messageService = inject(MessageService);
  
  // Search & Filter
  searchQuery = signal('');
  filterPayment = signal<string>('All');
  
  // Base Data
  patients = this.clinicState.patients;
  isLoading = this.clinicState.isLoading;

  // Computed Filtered Data
  filteredPatients = computed(() => {
    const q = this.searchQuery().toLowerCase();
    const filter = this.filterPayment();
    
    return this.patients().filter(p => {
      const matchesSearch = p.nameEn.toLowerCase().includes(q) || p.phone.includes(q);
      const matchesFilter = filter === 'All' || p.paymentType === filter;
      return matchesSearch && matchesFilter;
    });
  });

  // Modal / Drawer states
  showDrawer = signal(false); // Add Patient
  showViewDrawer = signal(false);
  showEditDrawer = signal(false);

  get isAddModalOpen(): boolean {
    return this.showDrawer();
  }
  set isAddModalOpen(val: boolean) {
    this.showDrawer.set(val);
  }

  get isEditModalOpen(): boolean {
    return this.showEditDrawer();
  }
  set isEditModalOpen(val: boolean) {
    this.showEditDrawer.set(val);
  }
  
  // Selected Patient for View/Edit
  selectedPatient = signal<Patient | null>(null);

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

  // Edit Patient Form (Working Copy)
  editPatientForm: Partial<Patient> = {};

  // Actions
  openDrawer() {
    this.showDrawer.set(true);
  }

  closeDrawer() {
    this.showDrawer.set(false);
  }

  viewPatient(patient: Patient) {
    this.selectedPatient.set(patient);
    this.showViewDrawer.set(true);
  }

  closeViewDrawer() {
    this.showViewDrawer.set(false);
    this.selectedPatient.set(null);
  }

  editPatient(patient: Patient) {
    this.selectedPatient.set(patient);
    // Create a shallow copy for the form
    this.editPatientForm = { ...patient, documents: { ...patient.documents } };
    this.showEditDrawer.set(true);
  }

  closeEditDrawer() {
    this.showEditDrawer.set(false);
    this.selectedPatient.set(null);
    this.editPatientForm = {};
  }

  async createProfile() {
    await this.clinicState.createPatient(this.newPatient);
    this.closeDrawer();
    this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Patient profile created' });
  }

  async updateProfile() {
    const p = this.selectedPatient();
    if (p) {
      await this.clinicState.updatePatient(p.id, this.editPatientForm);
      this.closeEditDrawer();
      this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Patient profile updated' });
    }
  }
}
