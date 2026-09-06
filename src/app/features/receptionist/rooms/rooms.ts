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
  
  // Forcing angular to recompile to refresh assets cache
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
    if (room.status === 'Occupied') return 'room-occupied';
    return 'room-available';
  }

  getRoomStatusLabel(room: Room): string {
    if (room.status === 'Maintenance') return 'Maintenance';
    if (room.status === 'Occupied') return 'Occupied';
    return 'Available';
  }

  async reassign(roomId: string, doctorId: string | null) {
    await this.clinicState.reassignRoom(roomId, doctorId);
    const msg = doctorId ? `Doctor assigned` : `Doctor cleared`;
    this.messageService.add({ severity: 'success', summary: 'Success', detail: msg });
    this.openDropdownId.set(null);
  }

  async setStatus(roomId: string, status: 'Available' | 'Occupied' | 'Maintenance') {
    await this.clinicState.changeRoomStatus(roomId, status);
    this.messageService.add({ severity: 'success', summary: 'Status Updated', detail: `Room marked as ${status}` });
    this.openDropdownId.set(null);
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
}
