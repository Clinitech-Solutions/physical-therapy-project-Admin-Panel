import { Component, signal, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TranslateModule } from '@ngx-translate/core';
import { ClinicStateService } from '../../../core/services/state/clinic-state.service';
import { MessageService } from 'primeng/api';

@Component({
  selector: "app-receptionist-rooms",
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: "./rooms.html"
})
export class RoomsComponent {
  clinicState = inject(ClinicStateService);
  messageService = inject(MessageService);
  
  rooms = this.clinicState.rooms;
  allDoctors = this.clinicState.doctors;

  async reassign(roomId: string, doctorId: string | null) {
    await this.clinicState.reassignRoom(roomId, doctorId);
    const msg = doctorId ? `Room reassigned` : `Room cleared`;
    this.messageService.add({ severity: 'success', summary: 'Success', detail: msg });
  }
}
