import { PatientRegistrationFieldsComponent } from '../../../shared/components/patient-registration-fields/patient-registration-fields';
import { ReceptionistLocale, ReceptionistTextPipe } from '../../../shared/receptionist-locale';
import { Component, signal, computed, inject, OnInit, ViewChild } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { InsuranceService } from '../../../core/services/insurance.service';
import { PatientService } from '../../../core/services/patient.service';
import { InsuranceDocumentService } from '../../../core/services/insurance-document.service';
import { BillingService } from '../../../core/services/billing.service';
import { Patient, PatientEditDraft } from '../../../core/models/patient.model';
import { emptyPatientRegistration, patientEditDraft, patientEditChanges, PatientInputError, PatientValidationError, patientOutcomeIsUnknown, patientServerError } from '../../../core/services/patient-registration';
import { MessageService, SharedModule } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';

import { PatientProfileComponent } from '../../../shared/components/patient-profile/patient-profile.component';

@Component({
  selector: "app-receptionist-patients",
  standalone: true,
  imports: [PatientRegistrationFieldsComponent, ReceptionistTextPipe, CommonModule, TranslateModule, FormsModule, DialogModule, ButtonModule, SharedModule, PatientProfileComponent],
  templateUrl: "./patients.html",
  styleUrl: "./patients.css",
})
export class PatientsComponent implements OnInit {
  readonly locale = new ReceptionistLocale();
  messageService = inject(MessageService);
  private insuranceService = inject(InsuranceService);
  private patientService = inject(PatientService);
  private insuranceDocService = inject(InsuranceDocumentService);
  private billingService = inject(BillingService, { optional: true });
  readonly saving = signal(false);
  readonly createdPatient = signal<Patient | null>(null);
  readonly creationOutcomeUnknown = this.patientService.creationOutcomeUnknown;
  readonly registrationError = signal('');
  readonly registrationValidationErrors = signal<PatientInputError[]>([]);
  @ViewChild('registrationFields') private registrationFields?: PatientRegistrationFieldsComponent;
  @ViewChild('editFields') private editFields?: PatientRegistrationFieldsComponent;
  readonly editLoading = signal(false);
  readonly updating = signal(false);
  readonly editError = signal('');
  readonly editValidationErrors = signal<PatientInputError[]>([]);
  readonly loadedEditPatient = signal<Patient | null>(null);
  private editGeneration = 0;
  readonly insuranceError = this.insuranceService.error;
  readonly insuranceLoading = this.insuranceService.loading;
  readonly patientsError = this.patientService.error;

  selectedFiles: File[] = [];

  onFilesSelected(event: any) {
    if (event.target.files) {
      this.selectedFiles = Array.from(event.target.files);
    }
  }

  ngOnInit() {
    this.insuranceService.getCompanies();
    this.refreshPatients();
    this.billingService?.getInvoices();
  }

  retryInsuranceLookup() { this.insuranceService.getCompanies(); }

  // Search & Filter
  searchQuery = signal('');
  filterPayment = signal<string>('All');
  filterCompany = signal<string>('All');
  
  // Available Insurance Companies
  insuranceCompanies = this.insuranceService.companies;

  // Base Data
  patients = this.patientService.patients;
  isLoading = this.patientService.loading;

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
      const matchesCompany = filterComp === 'All' || (p.paymentType === 'Insurance' && (p.insuranceCompanyName ?? p.insuranceDetails?.company) === filterComp);
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
    if (!val) this.closeEditDrawer();
    else this.showEditDrawer.set(true);
  }
  
  // Selected Patient for View/Edit
  selectedPatient = signal<Patient | null>(null);

  // New Patient Form
  newPatient = emptyPatientRegistration();

  // Edit Patient Form (Working Copy)
  editPatientForm: PatientEditDraft = { ...emptyPatientRegistration(), email: '' };

  get showExistingInsurance(): boolean {
    const original = this.loadedEditPatient();
    return !!original && original.paymentType == null && original.paymentType === this.editPatientForm.paymentType &&
      !!(original.insuranceDetails || original.insuranceCompanyId);
  }

  // Actions
  openDrawer() {
    if (this.saving()) return;
    if (!this.createdPatient()) {
      this.newPatient = emptyPatientRegistration();
      this.selectedFiles = [];
      this.registrationError.set('');
      this.registrationValidationErrors.set([]);
    }
    this.showDrawer.set(true);
  }

  closeDrawer() {
    if (!this.saving()) this.showDrawer.set(false);
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

  async editPatient(patient: Patient) {
    if (this.updating()) return;
    const generation = ++this.editGeneration;
    this.selectedPatient.set(patient);
    this.loadedEditPatient.set(null);
    this.editPatientForm = { ...emptyPatientRegistration(), email: '' };
    this.editError.set(''); this.editValidationErrors.set([]);
    this.editLoading.set(true);
    this.showEditDrawer.set(true);
    try {
      const saved = await firstValueFrom(this.patientService.getPatientById(Number(patient.id)));
      if (generation !== this.editGeneration) return;
      this.selectedPatient.set(saved);
      this.loadedEditPatient.set(saved);
      this.editPatientForm = patientEditDraft(saved);
    } catch (error) {
      if (generation === this.editGeneration) this.editError.set(patientServerError(error) ||
        this.locale.text('PATIENT_DETAILS_FAILED', 'Could not load patient details. Please retry.'));
    } finally {
      if (generation === this.editGeneration) this.editLoading.set(false);
    }
  }

  closeEditDrawer() {
    if (this.updating()) return;
    this.editGeneration++;
    this.showEditDrawer.set(false);
    this.selectedPatient.set(null);
    this.loadedEditPatient.set(null);
    this.editLoading.set(false);
    this.editPatientForm = { ...emptyPatientRegistration(), email: '' };
  }

  hideDialog() {
    this.closeDrawer();
  }

  savePatient() {
    return this.createProfile();
  }

  refreshPatients(afterSave = false) {
    this.patientService.getPatients().subscribe({
      error: () => this.messageService.add({
        severity: 'warn', summary: this.locale.text('ERROR', 'Error'),
        detail: this.locale.text(afterSave ? 'PATIENT_SAVED_REFRESH_FAILED' : 'PATIENT_LIST_FAILED',
          afterSave ? 'Patient saved. The list could not refresh; do not register again.' : 'Could not load patients. Please retry.')
      })
    });
  }

  async createProfile() {
    if (this.saving() || this.createdPatient() || this.creationOutcomeUnknown()) return;
    this.saving.set(true);
    this.registrationError.set('');
    this.registrationValidationErrors.set([]);
    try {
      const patient = await firstValueFrom(this.patientService.addPatient(this.newPatient));
      this.createdPatient.set(patient);
      this.refreshPatients(true);
    } catch (error) {
      const detail = patientOutcomeIsUnknown(error)
        ? this.locale.text('PATIENT_OUTCOME_UNKNOWN', 'The patient may have been saved. Check the patient list before registering again.')
        : error instanceof PatientValidationError ? error.errors.map(item => this.locale.text(item.key, item.message)).join('\n')
        : error instanceof PatientInputError ? this.locale.text(error.key, error.message)
        : patientServerError(error) || this.locale.text('FAILED_TO_CREATE_PATIENT', 'Failed to create patient.');
      this.registrationError.set(detail);
      this.registrationValidationErrors.set(error instanceof PatientValidationError ? error.errors : error instanceof PatientInputError ? [error] : []);
      this.registrationFields?.focusFirstInvalid();
      this.messageService.add({ severity: 'warn', summary: this.locale.text('ERROR', 'Error'), detail });
      this.saving.set(false);
      return;
    }
    this.saving.set(false);
    if (this.newPatient.paymentType === 'Insurance' && this.selectedFiles.length) {
      await this.retryDocumentUpload();
    } else {
      this.finishRegistration();
    }
  }

  async retryDocumentUpload() {
    const patient = this.createdPatient();
    if (!patient || this.saving() || !this.selectedFiles.length) return;
    this.saving.set(true);
    try {
      await firstValueFrom(this.insuranceDocService.uploadDocuments(Number(patient.id), this.selectedFiles));
    } catch (error) {
      this.registrationError.set(this.locale.text('PATIENT_CREATED_UPLOAD_RETRY',
        'Patient #{{id}} is saved. Document upload failed. Check uploaded documents before retrying if the outcome is uncertain.', { id: patient.id }) +
        (patientServerError(error) ? `\n${patientServerError(error)}` : ''));
      this.saving.set(false);
      return;
    }
    this.saving.set(false);
    this.finishRegistration();
  }

  finishRegistration() {
    if (this.saving() || !this.createdPatient()) return;
    this.messageService.add({ severity: 'success', summary: this.locale.text('SUCCESS', 'Success'),
      detail: this.locale.text('PATIENT_PROFILE_CREATED', 'Patient profile created') });
    this.createdPatient.set(null);
    this.selectedFiles = [];
    this.registrationError.set('');
    this.closeDrawer();
  }

  async updateProfile() {
    const original = this.loadedEditPatient();
    if (!original || this.editLoading() || this.updating()) return;
    this.updating.set(true); this.editError.set(''); this.editValidationErrors.set([]);
    try {
      const changes = patientEditChanges(original, this.editPatientForm);
      if (!Object.keys(changes).length) {
        this.editError.set(this.locale.text('PATIENT_NO_CHANGES', 'No changes to save.'));
        return;
      }
      await firstValueFrom(this.patientService.updatePatient(Number(original.id), changes));
    } catch (error) {
      const errors = error instanceof PatientValidationError ? error.errors : error instanceof PatientInputError ? [error] : [];
      const detail = errors.length ? errors.map(item => this.locale.text(item.key, item.message)).join('\n') :
        patientServerError(error) || this.locale.text('FAILED_TO_UPDATE_PATIENT', 'Failed to update patient.');
      this.editError.set(detail); this.editValidationErrors.set(errors);
      this.editFields?.focusFirstInvalid();
      this.messageService.add({ severity: 'warn', summary: this.locale.text('ERROR', 'Error'), detail });
      return;
    } finally {
      this.updating.set(false);
    }
    this.closeEditDrawer();
    this.messageService.add({ severity: 'success', summary: this.locale.text('SUCCESS', 'Success'),
      detail: this.locale.text('PATIENT_PROFILE_UPDATED', 'Patient profile updated') });
    this.refreshPatients(true);
  }

  deletePatient(id: string) {
    if(confirm(this.locale.text('ARE_YOU_SURE_YOU_WANT_TO_DELETE_THIS_PATIENT_', 'Are you sure you want to delete this patient?'))) {
      this.patientService.deletePatient(parseInt(id, 10) || 0).subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: this.locale.text('SUCCESS', "Success"), detail: this.locale.text('PATIENT_DELETED', "Patient deleted") });
          this.refreshPatients(true);
        },
        error: (err) => {
          this.messageService.add({ severity: 'warn', summary: this.locale.text('ERROR', "Error"), detail: this.locale.text('FAILED_TO_DELETE_PATIENT', "Failed to delete patient") });
          console.error(err);
        }
      });
    }
  }
}
