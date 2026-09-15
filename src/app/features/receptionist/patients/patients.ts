import { Component, signal, computed, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule, ReactiveFormsModule, FormBuilder } from '@angular/forms';

import { ClinicStateService } from '../../../core/services/state/clinic-state.service';
import { Patient, NewPatient, PaymentMethod, InsuranceDetails, FinancialPlan } from '../../../core/models/patient.model';
import { MessageService, SharedModule } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { SelectButtonModule } from 'primeng/selectbutton';
import { PatientProfileComponent } from '../../../shared/components/patient-profile/patient-profile.component';

@Component({
  selector: "app-receptionist-patients",
  standalone: true,
  imports: [CommonModule, TranslateModule, FormsModule, ReactiveFormsModule, DialogModule, ButtonModule, SelectButtonModule, SharedModule, PatientProfileComponent],
  templateUrl: "./patients.html",
})
export class PatientsComponent {
  clinicState = inject(ClinicStateService);
  messageService = inject(MessageService);
  private fb = inject(FormBuilder);

  // Main patientForm builder (Reactive Forms)
  patientForm = this.fb.group({
    nameEn: [''],
    nameAr: [''],
    phone: [''],
    gender: ['Male'],
    dob: [''],
    address: [''],
    occupation: [''],
    paymentType: ['Cash'],
    insuranceCompany: ['Bupa'],
    insuranceDetails: this.fb.group({
      company: ['Bupa'],
      status: ['Pending'],
      copayPercentage: [20],
      approvedSessions: [10],
      memberId: [''],
      employer: ['']
    }),
    financialPlan: this.fb.group({
      paymentMode: ['Per-Session'],
      totalAgreedAmount: [0],
      discount: [0],
      totalPaidSoFar: [0],
      sessionPrice: [0]
    }),
    docs: this.fb.group({
      medicalConsent: [false],
      liabilityWaiver: [false],
      idCard: [false]
    })
  });

  // Dynamic calculated remaining debt
  remainingDebt = signal<number>(0);

  // Payment mode options for PrimeNG SelectButton
  paymentModeOptions = [
    { label: 'Per-Session', labelKey: 'RECEPTIONIST.PER_SESSION', value: 'Per-Session' },
    { label: 'Package', labelKey: 'RECEPTIONIST.PACKAGE', value: 'Package' },
    { label: 'Upfront Copay', labelKey: 'RECEPTIONIST.UPFRONT_COPAY', value: 'Upfront-Copay' }
  ];

  get currentPaymentMode(): string {
    return this.patientForm.get('financialPlan.paymentMode')?.value || 'Per-Session';
  }

  constructor() {
    this.patientForm.get('financialPlan')?.valueChanges.subscribe(val => {
      const total = Number(val?.totalAgreedAmount) || 0;
      const discount = Number(val?.discount) || 0;
      const paid = Number(val?.totalPaidSoFar) || 0;
      const debt = (total - discount) - paid;
      this.remainingDebt.set(debt);
    });
  }
  
  // Search & Filter
  searchQuery = signal('');
  filterPayment = signal<string>('All');
  filterCompany = signal<string>('All');
  
  // Available Insurance Companies
  insuranceCompanies = ['Bupa', 'AXA', 'MetLife', 'Allianz'];

  // Base Data
  patients = this.clinicState.patients;
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
      financialPlan: {
        paymentMode: 'Per-Session',
        totalAgreedAmount: 0,
        discount: 0,
        netAmount: 0,
        totalPaidSoFar: 0,
        remainingDebt: 0,
        sessionPrice: 0
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
    this.patientForm.get('financialPlan')?.patchValue({
      paymentMode: 'Per-Session',
      totalAgreedAmount: 0,
      discount: 0,
      totalPaidSoFar: 0,
      sessionPrice: 0
    });
    this.remainingDebt.set(0);
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

  async createProfile() {
    if (!this.newPatient.nameEn) {
      this.messageService.add({ severity: 'error', summary: 'Validation Error', detail: 'Patient English name is required' });
      return;
    }
    if (this.newPatient.paymentType === 'Insurance' && this.newPatient.insuranceDetails) {
      this.newPatient.insuranceCompany = this.newPatient.insuranceDetails.company;
    }
    const fp = this.patientForm.get('financialPlan')?.value;
    if (fp) {
      const total = Number(fp.totalAgreedAmount) || 0;
      const discount = Number(fp.discount) || 0;
      const paid = Number(fp.totalPaidSoFar) || 0;
      const debt = (total - discount) - paid;
      this.newPatient.financialPlan = {
        paymentMode: (fp.paymentMode as any) || 'Per-Session',
        totalAgreedAmount: total,
        discount: discount,
        netAmount: total - discount,
        totalPaidSoFar: paid,
        remainingDebt: debt,
        sessionPrice: Number(fp.sessionPrice) || 0
      };
    }
    await this.clinicState.createPatient(this.newPatient);
    this.closeDrawer();
    this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Patient profile created' });
  }

  async updateProfile() {
    const p = this.selectedPatient();
    if (p) {
      if (this.editPatientForm.paymentType !== 'Insurance') {
        this.editPatientForm.insuranceDetails = undefined;
      }
      await this.clinicState.updatePatient(p.id, this.editPatientForm);
      this.closeEditDrawer();
      this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Patient profile updated' });
    }
  }
}

