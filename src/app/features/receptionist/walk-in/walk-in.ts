import { Component, signal, computed, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { BookingService } from '../../../core/services/api/booking.service';
import { MessageService } from 'primeng/api';

@Component({
  selector: "app-receptionist-walk-in",
  standalone: true,
  imports: [CommonModule, TranslateModule, FormsModule],
  templateUrl: "./walk-in.html"
})
export class WalkInComponent {
  bookingService = inject(BookingService);
  messageService = inject(MessageService);

  patient = signal('');
  gender = signal('Male');
  timePref = signal('Now');
  bookedDoctor = signal<string | null>(null);

  hasSearched = signal(false);
  isSearching = this.bookingService.searching;

  results = this.bookingService.doctorSlots;

  async searchSlots() {
    if (!this.patient()) return;
    this.hasSearched.set(false);
    this.bookedDoctor.set(null);
    await this.bookingService.searchSlots(this.gender());
    this.hasSearched.set(true);
  }

  bookSlot(doctor: string) {
    this.bookedDoctor.set(doctor);
    this.hasSearched.set(false);
    this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Walk-in session booked successfully' });
  }
}
