import { ReceptionistLocale, ReceptionistTextPipe } from '../../../shared/receptionist-locale';
import { Component, signal, computed, inject, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule, ReactiveFormsModule, FormBuilder } from '@angular/forms';

import { ClinicStateService } from '../../../core/services/state/clinic-state.service';
import { InsuranceService } from '../../../core/services/insurance.service';
import { PatientService } from '../../../core/services/patient.service';
import { InsuranceDocumentService } from '../../../core/services/insurance-document.service';
import { BillingService } from '../../../core/services/billing.service';
import { Patient, NewPatient, PaymentMethod, InsuranceDetails } from '../../../core/models/patient.model';
import { MessageService, SharedModule } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';

import { PatientProfileComponent } from '../../../shared/components/patient-profile/patient-profile.component';

@Component({
  selector: "app-receptionist-patients",
  standalone: true,
  imports: [ReceptionistTextPipe, CommonModule, TranslateModule, FormsModule, ReactiveFormsModule, DialogModule, ButtonModule, SharedModule, PatientProfileComponent],
  templateUrl: "./patients.html",
  styleUrl: "./patients.css",
})
export class PatientsComponent implements OnInit {
  readonly locale = new ReceptionistLocale();
  clinicState = inject(ClinicStateService);
  messageService = inject(MessageService);
  private insuranceService = inject(InsuranceService);
  private patientService = inject(PatientService);
  private insuranceDocService = inject(InsuranceDocumentService);
  private billingService = inject(BillingService, { optional: true });
  private fb = inject(FormBuilder);

  selectedFiles: File[] = [];

  onFilesSelected(event: any) {
    if (event.target.files) {
      this.selectedFiles = Array.from(event.target.files);
    }
  }

  ngOnInit() {
    this.insuranceService.getCompanies();
    this.patientService.getPatients().subscribe();
    this.billingService?.getInvoices();
  }

  // Main patientForm builder (Reactive Forms) — basic info + insurance only
  patientForm = this.fb.group({
    nameEn: [''],
    nameAr: [''],
    phone: [''],
    gender: ['Male'],
    dob: [''],
    address: [''],
    occupation: [''],
    paymentType: ['Cash'],
    insuranceCompanyId: [null],
    insuranceCompany: ['Bupa'],
    insuranceDetails: this.fb.group({
      company: ['Bupa'],
      status: ['Pending'],
      copayPercentage: [20],
      approvedSessions: [10],
      memberId: [''],
      employer: ['']
    }),
    docs: this.fb.group({
      medicalConsent: [false],
      liabilityWaiver: [false],
      idCard: [false]
    })
  });
  
  // Search & Filter
  searchQuery = signal('');
  filterPayment = signal<string>('All');
  filterCompany = signal<string>('All');
  
  // Available Insurance Companies
  insuranceCompanies = this.insuranceService.companies;

  // Base Data
  patients = this.patientService.patients;
  isLoading = this.clinicState.isLoading;

  // Computed Filtered Data
  filteredPatients = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const filterPay = this.filterPayment();
    const filterComp = this.filterCompany();
    
    return this.patients().filter(p => {
      const matchesSearch = !q || 
        p.nameEn.toLowerCase().includes(q) || 
        p.phone.includes(q) || 
        (p.nameAr && p.nameAr.includes(q));
      const matchesPayment = filterPay === 'All' || p.paymentType === filterPay;
      const matchesCompany = filterComp === 'All' || (p.paymentType === 'Insurance' && p.insuranceDetails?.company === filterComp);
      return matchesSearch && matchesPayment && matchesCompany;
    });
  });

  // Modal / Drawer states
  showDrawer = signal(false); // Add Patient
  showViewDrawer = signal(false);
  showEditDrawer = signal(false);
  showProfileModal = signal(false);
  selectedProfilePatient = signal<Patient | null>(null);

  get isAddModalOpen(): boolean {
    return this.showDrawer();
  }
  set isAddModalOpen(val: boolean) {
    this.showDrawer.set(val);
  }

  get patientDialog(): boolean {
    return this.showDrawer();
  }
  set patientDialog(val: boolean) {
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
  newPatient: NewPatient = this.initNewPatient();

  private initNewPatient(): NewPatient {
    return {
      nameEn: '',
      nameAr: '',
      phone: '',
      gender: 'Male',
      dob: '',
      address: '',
      occupation: '',
      paymentType: 'Cash',
      insuranceCompany: 'Bupa',
      insuranceDetails: {
        company: 'Bupa',
        status: 'Pending',
        copayPercentage: 20,
        approvedSessions: 10,
        memberId: '',
        employer: ''
      },
      docs: {
        medicalConsent: false,
        liabilityWaiver: false,
        idCard: false
      }
    };
  }

  // Edit Patient Form (Working Copy)
  editPatientForm: Partial<Patient> = {};

  // Actions
  openDrawer() {
    this.newPatient = this.initNewPatient();
    this.showDrawer.set(true);
  }

  closeDrawer() {
    this.showDrawer.set(false);
  }

  viewPatient(patient: Patient) {
    this.selectedPatient.set(patient);
    this.selectedProfilePatient.set(patient);
    this.showProfileModal.set(true);
  }

  closeViewDrawer() {
    this.showViewDrawer.set(false);
    this.selectedPatient.set(null);
  }

  editPatient(patient: Patient) {
    this.selectedPatient.set(patient);
    // Create a shallow copy for the form with deep copies of nested objects
    this.editPatientForm = { 
      ...patient, 
      documents: { ...patient.documents },
      insuranceDetails: patient.insuranceDetails 
        ? { ...patient.insuranceDetails } 
        : { company: 'Bupa', status: 'Pending', copayPercentage: 20, approvedSessions: 10, memberId: '', employer: '' },
      financialPlan: patient.financialPlan 
        ? { ...patient.financialPlan } 
        : patient.treatmentPlan?.financialPlan
        ? { ...patient.treatmentPlan.financialPlan }
        : undefined
    };
    this.showEditDrawer.set(true);
  }

  closeEditDrawer() {
    this.showEditDrawer.set(false);
    this.selectedPatient.set(null);
    this.editPatientForm = {};
  }

  hideDialog() {
    this.closeDrawer();
  }

  savePatient() {
    this.createProfile();
  }

  createProfile() {
    if (!this.newPatient.nameEn) {
      this.messageService.add({ severity: 'error', summary: this.locale.text('VALIDATION_ERROR', "Validation Error"), detail: this.locale.text('PATIENT_ENGLISH_NAME_IS_REQUIRED', "Patient English name is required") });
      return;
    }
    if (this.newPatient.paymentType === 'Insurance' && this.newPatient.insuranceDetails) {
      this.newPatient.insuranceCompany = this.newPatient.insuranceDetails.company;
    }

    this.patientService.addPatient(this.newPatient).subscribe({
      next: (res) => {
        const newPatientId = res?.id || res?.data?.id || (res?.items && res.items[0]?.id) || Date.now(); // Fallback for mock backend
        if (this.newPatient.paymentType === 'Insurance' && this.selectedFiles.length > 0) {
          this.insuranceDocService.uploadDocuments(newPatientId, this.selectedFiles).subscribe({
            next: () => {
              this.messageService.add({ severity: 'success', summary: this.locale.text('SUCCESS', "Success"), detail: this.locale.text('PATIENT_AND_DOCUMENT_CREATED', "Patient and document created") });
              this.closeDrawer();
              this.patientService.getPatients().subscribe();
            },
            error: (err) => {
              this.messageService.add({ severity: 'error', summary: this.locale.text('ERROR', "Error"), detail: this.locale.text('PATIENT_CREATED_BUT_DOCUMENT_UPLOAD_FAILED', "Patient created but document upload failed") });
              console.error(err);
            }
          });
        } else {
          this.messageService.add({ severity: 'success', summary: this.locale.text('SUCCESS', "Success"), detail: this.locale.text('PATIENT_PROFILE_CREATED', "Patient profile created") });
          this.closeDrawer();
          this.patientService.getPatients().subscribe();
        }
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: this.locale.text('ERROR', "Error"), detail: this.locale.text('FAILED_TO_CREATE_PATIENT', "Failed to create patient") });
        console.error(err);
      }
    });
  }

  updateProfile() {
    const p = this.selectedPatient();
    if (p) {
      if (this.editPatientForm.paymentType !== 'Insurance') {
        this.editPatientForm.insuranceDetails = undefined;
      }
      this.patientService.updatePatient(parseInt(p.id, 10) || 0, this.editPatientForm).subscribe({
        next: () => {
          this.closeEditDrawer();
          this.messageService.add({ severity: 'success', summary: this.locale.text('SUCCESS', "Success"), detail: this.locale.text('PATIENT_PROFILE_UPDATED', "Patient profile updated") });
          this.patientService.getPatients().subscribe();
        },
        error: (err) => {
          this.messageService.add({ severity: 'error', summary: this.locale.text('ERROR', "Error"), detail: this.locale.text('FAILED_TO_UPDATE_PATIENT', "Failed to update patient") });
          console.error(err);
        }
      });
    }
  }

  deletePatient(id: string) {
    if(confirm(this.locale.text('ARE_YOU_SURE_YOU_WANT_TO_DELETE_THIS_PATIENT_', 'Are you sure you want to delete this patient?'))) {
      this.patientService.deletePatient(parseInt(id, 10) || 0).subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: this.locale.text('SUCCESS', "Success"), detail: this.locale.text('PATIENT_DELETED', "Patient deleted") });
          this.patientService.getPatients().subscribe();
        },
        error: (err) => {
          this.messageService.add({ severity: 'error', summary: this.locale.text('ERROR', "Error"), detail: this.locale.text('FAILED_TO_DELETE_PATIENT', "Failed to delete patient") });
          console.error(err);
        }
      });
    }
  }
}
