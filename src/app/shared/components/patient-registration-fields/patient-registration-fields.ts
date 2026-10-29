import {
  afterNextRender,
  Component,
  ElementRef,
  inject,
  Injector,
  Input,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { TranslateModule } from "@ngx-translate/core";
import { NewPatient } from "../../../core/models/patient.model";
import { InsuranceCompany } from "../../../core/services/insurance.service";
import { PatientInputError } from "../../../core/services/patient-registration";

/** Shared patient fields for registration and edits. */
@Component({
  selector: "app-patient-registration-fields",
  standalone: true,
  imports: [FormsModule, TranslateModule],
  templateUrl: "./patient-registration-fields.html",
  styles: [
    ':host { display: block; } :host [aria-invalid="true"] { border-color: var(--color-danger) !important; }',
  ],
})
export class PatientRegistrationFieldsComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  @Input({ required: true }) draft!: NewPatient & { email?: string };
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() showInsuranceDetails = false;
  @Input({ required: true }) formId = "patient-registration";
  @Input() validationErrors: PatientInputError[] = [];
  @Input() companies: InsuranceCompany[] = [];
  @Input() insuranceLoading = false;
  @Input() insuranceError: string | null = null;

  readonly paymentTypes = ['Cash', 'Insurance', 'Online', 'Card', 'InstaPay'];

  companiesHaveSelectedId(): boolean {
    return this.companies.some(company => company.id === this.draft.insuranceCompanyId);
  }

  errorFor(field: string): string | undefined {
    return this.validationErrors.find((error) => error.field === field)?.key;
  }

  focusFirstInvalid() {
    afterNextRender(
      () => {
        this.host.nativeElement
          .querySelector<HTMLElement>('[aria-invalid="true"]')
          ?.focus();
      },
      { injector: this.injector },
    );
  }
}
