import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { InsuranceService, InsuranceCompany } from '../../../core/services/insurance.service';

@Component({
  selector: 'app-insurance-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './insurance-management.component.html',
  styleUrls: ['./insurance-management.component.css']
})
export class InsuranceManagementComponent implements OnInit {
  private insuranceService = inject(InsuranceService);
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);

  companies = this.insuranceService.companies;
  loading = this.insuranceService.loading;
  error = this.insuranceService.error;

  companyForm: FormGroup;
  showModal = false;
  editingCompany: InsuranceCompany | null = null;
  isSubmitting = false;

  constructor() {
    this.companyForm = this.fb.group({
      name: ['', Validators.required],
      portalUrl: [''],
      hotline: [''],
      isActive: [true]
    });
  }

  ngOnInit(): void {
    this.insuranceService.getCompanies();
  }

  openModal(company?: InsuranceCompany): void {
    if (company) {
      this.editingCompany = company;
      this.companyForm.patchValue({
        name: company.name,
        portalUrl: company.portalUrl,
        hotline: (company as any).hotline || '',
        isActive: company.isActive
      });
    } else {
      this.editingCompany = null;
      this.companyForm.reset({ isActive: true });
    }
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingCompany = null;
    this.companyForm.reset({ isActive: true });
  }

  onSubmit(): void {
    if (this.companyForm.invalid) {
      this.companyForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    const payload = this.companyForm.value;

    if (this.editingCompany?.id) {
      this.insuranceService.updateCompany(this.editingCompany.id, payload).subscribe({
        next: () => {
          this.insuranceService.getCompanies();
          this.closeModal();
          this.isSubmitting = false;
        },
        error: (err) => {
          console.error('Error updating company', err);
          this.isSubmitting = false;
        }
      });
    } else {
      this.insuranceService.addCompany(payload).subscribe({
        next: () => {
          this.insuranceService.getCompanies();
          this.closeModal();
          this.isSubmitting = false;
        },
        error: (err) => {
          console.error('Error adding company', err);
          this.isSubmitting = false;
        }
      });
    }
  }

  onDelete(id: number | undefined): void {
    if (!id) return;
    const confirmMsg = this.translate.instant('CEO.INSURANCE_MANAGEMENT.CONFIRM_DELETE');
    if (confirm(confirmMsg)) {
      this.insuranceService.deleteCompany(id).subscribe({
        next: () => {
          this.insuranceService.getCompanies();
        },
        error: (err) => {
          console.error('Error deleting company', err);
        }
      });
    }
  }
}
