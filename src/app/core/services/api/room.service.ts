import { Injectable, signal } from '@angular/core';
import { Room } from '../../models/room.model';
import { mockRooms } from '../../mock-data/mock-db';

@Injectable({
  providedIn: 'root'
})
export class RoomService {
  private roomsSignal = signal<Room[]>([]);
  public rooms = this.roomsSignal.asReadonly();
  public loading = signal<boolean>(false);

  constructor() {
    this.fetchRooms();
  }

  async fetchRooms() {
    this.loading.set(true);
    await new Promise(resolve => setTimeout(resolve, 400));
    this.roomsSignal.set([...mockRooms]);
    this.loading.set(false);
  }

  async reassignRoom(roomId: string, doctorId: string | null) {
    this.loading.set(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    this.roomsSignal.update(rooms => rooms.map(r => {
      if (r.id === roomId) {
        if (doctorId) {
          return { ...r, status: 'Occupied', doctorId: doctorId, currentLoad: 1, capacity: r.capacity };
        } else {
          return { ...r, status: 'Available', doctorId: null, currentLoad: 0, capacity: r.capacity };
        }
      }
      return r;
    }));
    this.loading.set(false);
  }
}
