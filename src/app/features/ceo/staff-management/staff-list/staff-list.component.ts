import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { UserService, User } from '../../../../core/services/user.service';
import { AddUserComponent } from '../add-user/add-user.component';

@Component({
  selector: 'app-staff-list',
  standalone: true,
  imports: [CommonModule, AddUserComponent, ReactiveFormsModule],
  templateUrl: './staff-list.component.html',
  styleUrl: './staff-list.component.css'
})
export class StaffListComponent implements OnInit {
  userService = inject(UserService);
  fb = inject(FormBuilder);

  showAddForm = signal(false);

  selectedUser: User | null = null;
  editForm!: FormGroup;

  roles = ['Admin', 'Owner', 'Doctor', 'Patient', 'Senior', 'Receptionist', 'Ceo'];

  ngOnInit() {
    this.loadUsers();
    this.editForm = this.fb.group({
      fullName: ['', Validators.required],
      userName: ['', Validators.required],
      gender: [0, Validators.required],
      birthDate: ['', Validators.required],
      role: ['', Validators.required]
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
    this.selectedUser = user;
    this.editForm.patchValue({
      fullName: user.fullName || '',
      userName: user.userName || '',
      gender: user.gender !== undefined ? user.gender : 0,
      birthDate: user.birthDate || '',
      role: user.roles?.[0] || ''
    });
  }

  onDelete(user: User) {
    if (window.confirm('Are you sure you want to delete this user?')) {
      if (user.id) {
        this.userService.deleteUser(user.id).subscribe({
          next: () => this.loadUsers(),
          error: (err) => console.error('Delete error', err)
        });
      }
    }
  }

  onUpdate() {
    if (this.editForm.valid && this.selectedUser?.id) {
      const formValues = this.editForm.getRawValue();
      const payload = {
        id: this.selectedUser.id,
        fullName: formValues.fullName,
        userName: formValues.userName,
        gender: Number(formValues.gender),
        birthDate: formValues.birthDate,
        roles: [formValues.role]
      };

      this.userService.updateUser(payload).subscribe({
        next: () => {
          this.loadUsers();
          this.selectedUser = null;
        },
        error: (err) => console.error('Update error', err)
      });
    } else {
      this.editForm.markAllAsTouched();
    }
  }

  closeEditModal() {
    this.selectedUser = null;
  }
}
