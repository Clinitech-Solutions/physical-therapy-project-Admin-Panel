import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { NewPatient } from '../../../core/models/patient.model';
import { InsuranceCompany } from '../../../core/services/insurance.service';

/** The two registration entry points submit the same draft and backend contract. */
@Component({
  selector: 'app-patient-registration-fields',
  standalone: true,
  imports: [FormsModule, TranslateModule],
  templateUrl: './patient-registration-fields.html'
})
export class PatientRegistrationFieldsComponent {
  @Input({ required: true }) draft!: NewPatient;
  @Input() companies: InsuranceCompany[] = [];
  @Input() insuranceLoading = false;
  @Input() insuranceError: string | null = null;
}
