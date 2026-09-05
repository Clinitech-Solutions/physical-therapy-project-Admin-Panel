import { Component, signal, computed, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { ClinicStateService } from '../../../core/services/state/clinic-state.service';
import { MessageService } from 'primeng/api';
import { SelectModule } from 'primeng/select';

@Component({
  selector: "app-receptionist-walk-in",
  standalone: true,
  imports: [CommonModule, TranslateModule, FormsModule, SelectModule],
  templateUrl: "./walk-in.html"
})
export class WalkInComponent {
  clinicState = inject(ClinicStateService);
  messageService = inject(MessageService);

  allPatients = this.clinicState.patients;
  allDoctors = this.clinicState.doctors;
  allRooms = this.clinicState.rooms;

  patientId = signal('');
  gender = signal('Male');
  timePref = signal('Now');
  bookedDoctorId = signal<string | null>(null);

  hasSearched = signal(false);
  isSearching = this.clinicState.isSearching;

  results = this.clinicState.doctorSlots;

  getPatient(id: string) {
    return this.allPatients().find(p => p.id === id);
  }

  getDoctor(id: string | null) {
    if (!id) return null;
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
    await this.clinicState.searchSlots(this.gender());
    this.hasSearched.set(true);
  }

  bookSlot(doctorId: string | null) {
    this.bookedDoctorId.set(doctorId);
    this.hasSearched.set(false);
    this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Walk-in session booked successfully' });
  }
}
