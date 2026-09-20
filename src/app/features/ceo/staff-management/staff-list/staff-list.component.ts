import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../../../../core/services/user.service';
import { AddUserComponent } from '../add-user/add-user.component';

@Component({
  selector: 'app-staff-list',
  standalone: true,
  imports: [CommonModule, AddUserComponent],
  templateUrl: './staff-list.component.html',
})
export class StaffListComponent implements OnInit {
  userService = inject(UserService);

  showAddForm = signal(false);

  ngOnInit() {
    this.loadUsers();
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
}
