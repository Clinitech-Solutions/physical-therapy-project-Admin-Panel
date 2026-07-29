import { Component, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: "app-receptionist-rooms",
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: "./rooms.html"
})
export class RoomsComponent {
  rooms = signal([
    { name: 'Room 1', status: 'Occupied', doctor: 'Dr. Sarah', load: '1/2' },
    { name: 'Room 2', status: 'Available', doctor: null as string | null, load: null as string | null },
    { name: 'Room 3', status: 'Occupied', doctor: 'Dr. Omar', load: '2/2' },
    { name: 'Room 4', status: 'Maintenance', doctor: null as string | null, load: null as string | null },
    { name: 'Room 5', status: 'Available', doctor: null as string | null, load: null as string | null },
  ]);

  reassign(roomName: string, doctorName: string | null) {
    this.rooms.update(rooms => rooms.map(r => {
      if (r.name === roomName) {
        if (doctorName) {
          return { ...r, status: 'Occupied', doctor: doctorName, load: '1/2' };
        } else {
          return { ...r, status: 'Available', doctor: null, load: null };
        }
      }
      return r;
    }));
  }
}
