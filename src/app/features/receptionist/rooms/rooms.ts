import { ReceptionistLocale } from '../../../shared/receptionist-locale';
import { Component, signal, inject, HostListener } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TranslateModule } from '@ngx-translate/core';
import { ClinicStateService } from '../../../core/services/state/clinic-state.service';
import { MessageService } from 'primeng/api';
import { Room } from '../../../core/models/room.model';
import { FormsModule } from '@angular/forms';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { DialogModule } from 'primeng/dialog';

@Component({
  selector: "app-receptionist-rooms",
  standalone: true,
  imports: [CommonModule, TranslateModule, FormsModule, ToggleSwitchModule, DialogModule],
  templateUrl: "./rooms.html",
  styleUrl: "./rooms.css"
})
export class RoomsComponent {
  readonly locale = new ReceptionistLocale();
  clinicState = inject(ClinicStateService);
  messageService = inject(MessageService);
  
  rooms = this.clinicState.rooms;
  allDoctors = this.clinicState.doctors;

  // Add Room Modal State
  isAddRoomModalOpen = signal(false);
  isSubmitting = signal(false);
  newRoom = {
    displayName: '',
    capacity: 1,
    status: 'Available' as 'Available' | 'Maintenance' | 'Occupied',
    doctorId: null as string | null
  };

  openAddRoomModal() {
    this.newRoom = {
      displayName: '',
      capacity: 1,
      status: 'Available',
      doctorId: null
    };
    this.isAddRoomModalOpen.set(true);
  }

  closeAddRoomModal() {
    this.isAddRoomModalOpen.set(false);
  }

  async saveNewRoom() {
    if (!this.newRoom.displayName.trim()) {
      return;
    }

    try {
      this.isSubmitting.set(true);
      await this.clinicState.addNewRoom({
        displayName: this.newRoom.displayName.trim(),
        capacity: Number(this.newRoom.capacity) || 1,
        status: this.newRoom.status,
        doctorId: this.newRoom.status === 'Occupied' ? this.newRoom.doctorId : (this.newRoom.doctorId || null),
        currentLoad: 0
      });
      this.messageService.add({
        severity: 'success',
        summary: this.locale.text('ROOM_ADDED', "Room Added"),
        detail: this.locale.text('NEW_ROOM_HAS_BEEN_SUCCESSFULLY_ADDED_', "New room has been successfully added.")
      });
      this.closeAddRoomModal();
    } catch (e: any) {
      this.messageService.add({
        severity: 'error',
        summary: this.locale.text('ERROR', "Error"),
        detail: this.locale.error(e, 'FAILED_TO_ADD_ROOM_', "Failed to add room.")
      });
    } finally {
      this.isSubmitting.set(false);
    }
  }

  // Determines visual state for the floor plan
  getRoomStatusCssClass(room: Room): string {
    if (room.status === 'Maintenance') return 'maintenance';
    if (room.status === 'Occupied') return 'occupied';
    if (room.status === 'Available') return 'available';
    return 'unknown';
  }

  getRoomStatusLabel(room: Room): string {
    if (room.status === 'Maintenance') return 'RECEPTIONIST.MAINTENANCE';
    if (room.status === 'Occupied') return 'RECEPTIONIST.OCCUPIED';
    if (room.status === 'Available') return 'RECEPTIONIST.AVAILABLE';
    return 'RECEPTIONIST.ROOMS.UNKNOWN_STATUS';
  }

  // Identifies doctors managing multiple rooms and assigns a distinct theme color to visually link them
  getDoctorTheme(doctorId: string | null) {
    if (!doctorId) return null;
    const rooms = this.clinicState.rooms();
    const docRooms = rooms.filter(r => r.doctorId === doctorId && r.status !== 'Maintenance');
    
    if (docRooms.length > 1) {
       const themes = [
         { bg: 'rgba(139, 92, 246, 0.1)', text: '#8b5cf6', border: '#8b5cf6', name: 'purple' },
         { bg: 'rgba(219, 39, 119, 0.1)', text: '#db2777', border: '#db2777', name: 'pink' },
         { bg: 'rgba(8, 145, 178, 0.1)', text: '#0891b2', border: '#0891b2', name: 'cyan' },
         { bg: 'rgba(234, 88, 12, 0.1)', text: '#ea580c', border: '#ea580c', name: 'orange' }
       ];
       const hash = doctorId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
       return themes[hash % themes.length];
    }
    return null;
  }

  getRoomThemeBg(doctorId: string | null): string {
    const theme = this.getDoctorTheme(doctorId);
    return theme ? theme.bg : 'transparent';
  }

  async assignDoctor(roomId: string, doctorId: string | null) {
    try {
      await this.clinicState.reassignRoom(roomId, doctorId);
      this.messageService.add({ severity: 'success', summary: this.locale.text('DOCTOR_ASSIGNED', "Doctor Assigned"), detail: this.locale.text('ROOM_ASSIGNMENT_UPDATED_', "Room assignment updated.") });
    } catch (e: any) {
      this.messageService.add({ severity: 'error', summary: this.locale.text('ASSIGNMENT_FAILED', "Assignment Failed"), detail: this.locale.error(e, 'ASSIGNMENT_FAILED', 'Assignment Failed') });
      // We might want to refresh the rooms list here or rely on signals
    }
  }

  async toggleMaintenance(roomId: string) {
    await this.clinicState.toggleRoomMaintenance(roomId);
    this.messageService.add({ severity: 'success', summary: this.locale.text('STATUS_UPDATED', "Status Updated"), detail: this.locale.text('MAINTENANCE_STATUS_TOGGLED', "Maintenance status toggled") });
  }
}
