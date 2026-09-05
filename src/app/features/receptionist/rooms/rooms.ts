import { Component, signal, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TranslateModule } from '@ngx-translate/core';
import { RoomService } from '../../../core/services/api/room.service';
import { DoctorService } from '../../../core/services/api/doctor.service';
import { MessageService } from 'primeng/api';

@Component({
  selector: "app-receptionist-rooms",
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: "./rooms.html"
})
export class RoomsComponent {
  roomService = inject(RoomService);
  doctorService = inject(DoctorService);
  messageService = inject(MessageService);
  
  rooms = this.roomService.rooms;
  allDoctors = this.doctorService.doctors;

  getDoctor(id: string) {
    return this.allDoctors().find(d => d.id === id);
  }

  async reassign(roomId: string, doctorId: string | null) {
    await this.roomService.reassignRoom(roomId, doctorId);
    const msg = doctorId ? `Room reassigned` : `Room cleared`;
    this.messageService.add({ severity: 'success', summary: 'Success', detail: msg });
  }
}
