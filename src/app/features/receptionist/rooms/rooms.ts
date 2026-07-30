import { Component, signal, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TranslateModule } from '@ngx-translate/core';
import { RoomService } from '../../../core/services/api/room.service';
import { MessageService } from 'primeng/api';
@Component({
  selector: "app-receptionist-rooms",
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: "./rooms.html"
})
export class RoomsComponent {
  roomService = inject(RoomService);
  messageService = inject(MessageService);
  rooms = this.roomService.rooms;

  async reassign(roomName: string, doctorName: string | null) {
    await this.roomService.reassignRoom(roomName, doctorName);
    this.messageService.add({ severity: 'success', summary: 'Success', detail: `Room reassigned to ${doctorName}` });
  }
}
