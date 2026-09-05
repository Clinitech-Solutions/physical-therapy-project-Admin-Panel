import { Component, signal, computed, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { BookingService } from '../../../core/services/api/booking.service';
import { PatientService } from '../../../core/services/api/patient.service';
import { DoctorService } from '../../../core/services/api/doctor.service';
import { RoomService } from '../../../core/services/api/room.service';
import { MessageService } from 'primeng/api';
import { SelectModule } from 'primeng/select';

@Component({
  selector: "app-receptionist-walk-in",
  standalone: true,
  imports: [CommonModule, TranslateModule, FormsModule, SelectModule],
  templateUrl: "./walk-in.html"
})
export class WalkInComponent {
  bookingService = inject(BookingService);
  patientService = inject(PatientService);
  doctorService = inject(DoctorService);
  roomService = inject(RoomService);
  messageService = inject(MessageService);

  allPatients = this.patientService.patients;
  allDoctors = this.doctorService.doctors;
  allRooms = this.roomService.rooms;

  patientId = signal('');
  gender = signal('Male');
  timePref = signal('Now');
  bookedDoctorId = signal<string | null>(null);

  hasSearched = signal(false);
  isSearching = this.bookingService.searching;

  results = this.bookingService.doctorSlots;

  getPatient(id: string) {
    return this.allPatients().find(p => p.id === id);
  }

  getDoctor(id: string) {
    return this.allDoctors().find(d => d.id === id);
  }

  getRoom(id: string) {
    return this.allRooms().find(r => r.id === id);
  }

  formatTime(isoString: string) {
    try {
      return new Date(isoString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  }

  onPatientSelect(event: any) {
    const p = this.allPatients().find(x => x.id === event.value);
    if (p) {
      this.gender.set(p.gender);
    }
  }

  async searchSlots() {
    if (!this.patientId()) return;
    this.hasSearched.set(false);
    this.bookedDoctorId.set(null);
    await this.bookingService.searchSlots(this.gender());
    this.hasSearched.set(true);
  }

  bookSlot(doctorId: string) {
    this.bookedDoctorId.set(doctorId);
    this.hasSearched.set(false);
    this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Walk-in session booked successfully' });
  }
}
