import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { UserService, User } from '../../../../core/services/user.service';
import { AddUserComponent } from '../add-user/add-user.component';
import { TranslateModule } from '@ngx-translate/core';
import { StaffWorkingHoursComponent } from '../staff-working-hours/staff-working-hours';
import { StaffWorkingHours, validStaffWorkingHours, serializeStaffWorkingHours } from '../../../../core/models/staff-working-hours.model';
import { apiError } from '../../../../core/services/reception-api';

@Component({
  selector: 'app-staff-list',
  standalone: true,
  imports: [CommonModule, AddUserComponent, ReactiveFormsModule, TranslateModule, StaffWorkingHoursComponent],
  templateUrl: './staff-list.component.html',
  styleUrl: './staff-list.component.css'
})
export class StaffListComponent implements OnInit {
  userService = inject(UserService);
  fb = inject(FormBuilder);

  showAddForm = signal(false);

  selectedUser: User | null = null;
  userToDelete: User | null = null;
  editForm!: FormGroup;
  isUpdating = false;
  updateError = '';

  roles = ['Admin', 'Owner', 'Doctor', 'Patient', 'Senior', 'Receptionist', 'Ceo'];

  ngOnInit() {
    this.loadUsers();
    this.editForm = this.fb.group({
      fullName: ['', Validators.required],
      userName: ['', Validators.required],
      gender: [0, Validators.required],
      birthDate: ['', Validators.required],
      role: ['', Validators.required],
      workingHours: this.fb.nonNullable.control<StaffWorkingHours[]>([], control => validStaffWorkingHours(control.value) ? null : { workingHours: true })
    });
  }

  loadUsers() {
    this.userService.getAllUsers();
  }

  toggleAddForm() {
    this.showAddForm.update(v => !v);
  }

  onUserAdded() {
    this.showAddForm.set(false);
    this.loadUsers();
  }

  onEdit(user: User) {
    if (this.isUpdating) return;
    this.selectedUser = user;
    this.updateError = '';
    this.editForm.patchValue({
      fullName: user.fullName || '',
      userName: user.userName || '',
      gender: user.gender === 'Male' ? 0 : user.gender === 'Female' ? 1 : Number(user.gender ?? 0),
      birthDate: user.birthDate?.slice(0, 10) || '',
      role: user.roles[0] || '',
      workingHours: (user.workingHours ?? []).map(window => ({ ...window }))
    });
  }

  onDelete(user: User) {
    this.userToDelete = user;
  }

  confirmDelete() {
    if (this.userToDelete?.id) {
      this.userService.deleteUser(this.userToDelete.id).subscribe({
        next: () => {
          this.loadUsers();
          this.userToDelete = null;
        },
        error: (err) => {
          console.error('Delete error', err);
          this.userToDelete = null;
        }
      });
    }
  }

  closeDeleteModal() {
    this.userToDelete = null;
  }

  onUpdate() {
    if (this.isUpdating) return;
    if (this.editForm.valid && this.selectedUser?.id) {
      this.isUpdating = true; this.updateError = '';
      const formValues = this.editForm.getRawValue();
      const payload = {
        userId: this.selectedUser.id,
        fullName: formValues.fullName,
        userName: formValues.userName,
        gender: Number(formValues.gender),
        birthDate: formValues.birthDate,
        roles: [formValues.role],
        workingHours: serializeStaffWorkingHours(formValues.workingHours)
      };

      this.userService.updateUser(payload).subscribe({
        next: () => {
          this.isUpdating = false;
          this.loadUsers();
          this.selectedUser = null;
        },
        error: (err) => { this.isUpdating = false; this.updateError = apiError(err); }
      });
    } else {
      this.editForm.markAllAsTouched();
    }
  }

  closeEditModal() {
    if (!this.isUpdating) this.selectedUser = null;
  }
  onEditRoleChange() { if (this.editForm.get('role')?.value === 'Patient') this.editForm.get('workingHours')?.setValue([]); }
}
