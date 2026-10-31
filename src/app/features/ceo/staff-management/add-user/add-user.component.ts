import { Component, inject, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { UserService } from '../../../../core/services/user.service';
import { TranslateModule } from '@ngx-translate/core';
import { StaffWorkingHoursComponent } from '../staff-working-hours/staff-working-hours';
import { StaffWorkingHours, validStaffWorkingHours, serializeStaffWorkingHours } from '../../../../core/models/staff-working-hours.model';
import { apiError } from '../../../../core/services/reception-api';

@Component({
  selector: 'app-add-user',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, StaffWorkingHoursComponent],
  templateUrl: './add-user.component.html',
  styleUrl: './add-user.component.css'
})
export class AddUserComponent {
  private fb = inject(FormBuilder);
  private userService = inject(UserService);

  userAdded = output<void>();

  roles = ['Admin', 'Owner', 'Doctor', 'Patient', 'Senior', 'Receptionist', 'Ceo'];

  userForm = this.fb.nonNullable.group({
    fullName: ['', Validators.required],
    userName: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(6)]],
    gender: [0, Validators.required],
    birthDate: ['', Validators.required],
    role: ['', Validators.required],
    workingHours: this.fb.nonNullable.control<StaffWorkingHours[]>([])
  }, { validators: form => form.get('role')?.value === 'Patient' || validStaffWorkingHours(form.get('workingHours')?.value ?? []) ? null : { workingHours: true } });

  isSubmitting = false;
  showPassword = false;
  saveError = '';
  onRoleChange() { if (this.userForm.controls.role.value === 'Patient') this.userForm.controls.workingHours.setValue([]); }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  onSubmit() {
    if (this.isSubmitting) return;
    if (this.userForm.valid) {
      this.isSubmitting = true;
      this.saveError = '';
      const formValues = this.userForm.getRawValue();
      const payload = {
        fullName: formValues.fullName,
        userName: formValues.userName,
        password: formValues.password,
        gender: Number(formValues.gender),
        birthDate: formValues.birthDate,
        roles: [formValues.role],
        workingHours: serializeStaffWorkingHours(formValues.workingHours)
      };

      this.userService.addUser(payload).subscribe({
        next: () => {
          this.isSubmitting = false;
          this.userForm.reset();
          this.userAdded.emit();
        },
        error: (err) => {
          this.isSubmitting = false;
          this.saveError = apiError(err);
        }
      });
    } else {
      this.userForm.markAllAsTouched();
    }
  }
}
