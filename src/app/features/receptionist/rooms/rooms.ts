import { Component, signal, inject, HostListener } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TranslateModule } from '@ngx-translate/core';
import { ClinicStateService } from '../../../core/services/state/clinic-state.service';
import { MessageService } from 'primeng/api';
import { Room } from '../../../core/models/room.model';

@Component({
  selector: "app-receptionist-rooms",
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: "./rooms.html",
  styleUrl: "./rooms.css"
})
export class RoomsComponent {
  clinicState = inject(ClinicStateService);
  messageService = inject(MessageService);
  
  rooms = this.clinicState.rooms;
  allDoctors = this.clinicState.doctors;

  // Dropdown State Management
  openDropdownId = signal<string | null>(null);

  toggleDropdown(id: string, event: Event) {
    event.stopPropagation();
    if (this.openDropdownId() === id) {
      this.openDropdownId.set(null);
    } else {
      this.openDropdownId.set(id);
    }
  }

  @HostListener('document:click')
  onDocumentClick() {
    this.openDropdownId.set(null);
  }

  // Determines visual state for the floor plan
  getRoomStatusCssClass(room: Room): string {
    if (room.status === 'Maintenance') return 'room-maintenance';
    if (room.currentLoad === 0) return 'room-available';
    if (room.currentLoad > 0 && room.currentLoad < room.capacity) return 'room-in-progress';
    if (room.currentLoad === room.capacity) return 'room-occupied';
    return 'room-available';
  }

  getRoomStatusLabel(room: Room): string {
    if (room.status === 'Maintenance') return 'Maintenance';
    if (room.currentLoad === 0) return 'Available';
    if (room.currentLoad > 0 && room.currentLoad < room.capacity) return 'In Progress';
    if (room.currentLoad === room.capacity) return 'Occupied';
    return 'Available';
  }

  async reassign(roomId: string, doctorId: string | null) {
    await this.clinicState.reassignRoom(roomId, doctorId);
    const msg = doctorId ? `Room reassigned` : `Room cleared`;
    this.messageService.add({ severity: 'success', summary: 'Success', detail: msg });
  }

  // Helper just to demo maintenance toggling via our mocked reassign logic temporarily
  async toggleMaintenance(roomId: string, setMaintenance: boolean) {
    if (setMaintenance) {
      await this.clinicState.reassignRoom(roomId, 'maintenance'); // Simple mock hack
      this.messageService.add({ severity: 'info', summary: 'Maintenance', detail: 'Room set to maintenance' });
    } else {
      await this.clinicState.reassignRoom(roomId, null);
      this.messageService.add({ severity: 'success', summary: 'Restored', detail: 'Room available' });
    }
  }
}
