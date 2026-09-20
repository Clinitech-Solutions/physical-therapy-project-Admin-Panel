import { Component, inject, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { UserService } from '../../../../core/services/user.service';

@Component({
  selector: 'app-add-user',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './add-user.component.html'
})
export class AddUserComponent {
  private fb = inject(FormBuilder);
  private userService = inject(UserService);

  userAdded = output<void>();

  roles = ['CEO', 'Doctor', 'Senior Therapist', 'Receptionist'];

  userForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    username: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(6)]],
    role: ['', Validators.required]
  });

  isSubmitting = false;

  onSubmit() {
    if (this.userForm.valid) {
      this.isSubmitting = true;
      this.userService.addUser(this.userForm.getRawValue()).subscribe({
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
