import { Component, inject, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { UserService } from '../../../../core/services/user.service';

@Component({
  selector: 'app-add-user',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './add-user.component.html',
  styles: [`
    .form-control, .form-select {
      height: 40px;
      padding: 0.5rem 1rem;
    }
    .input-group .form-control {
      height: 40px;
    }
    .input-group .btn {
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 1rem;
    }
    input[type="date"].form-control {
      appearance: none;
      min-height: 40px; 
    }
  `]
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
    role: ['', Validators.required]
  });

  isSubmitting = false;
  showPassword = false;

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  onSubmit() {
    if (this.userForm.valid) {
      this.isSubmitting = true;
      const formValues = this.userForm.getRawValue();
      const payload = {
        fullName: formValues.fullName,
        userName: formValues.userName,
        password: formValues.password,
        gender: Number(formValues.gender),
        birthDate: formValues.birthDate,
        roles: [formValues.role]
      };

      this.userService.addUser(payload as any).subscribe({
        next: () => {
          this.isSubmitting = false;
          this.userForm.reset();
          this.userAdded.emit();
        },
        error: (err) => {
          this.isSubmitting = false;
          console.error('Failed to add user', err);
          // could show error toast here
        }
      });
    } else {
      this.userForm.markAllAsTouched();
    }
  }
}
