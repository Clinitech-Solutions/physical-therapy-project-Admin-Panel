import { Component, signal, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { BookingService } from '../../../core/services/api/booking.service';
import { MessageService } from 'primeng/api';

@Component({
  selector: "app-receptionist-bookings",
  standalone: true,
  imports: [CommonModule, TranslateModule, FormsModule],
  templateUrl: "./bookings.html",
  styleUrl: "./bookings.css"
})
export class BookingsComponent {
  bookingService = inject(BookingService);
  messageService = inject(MessageService);

  viewMode = signal<'Week' | 'Day'>('Day');

  // Book Assessment Drawer
  showAssessmentDrawer = signal(false);
  assessmentForm = { patient: '', senior: '', date: '', time: '' };

  // Book Session Drawer
  showSessionDrawer = signal(false);
  sessionForm = { patient: '', doctor: '', room: '', date: '', time: '' };

  openAssessmentDrawer() {
    this.showAssessmentDrawer.set(true);
  }

  closeAssessmentDrawer() {
    this.showAssessmentDrawer.set(false);
  }

  confirmAssessment() {
    this.closeAssessmentDrawer();
    this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Assessment booked successfully' });
  }

  openSessionDrawer() {
    this.showSessionDrawer.set(true);
  }

  closeSessionDrawer() {
    this.showSessionDrawer.set(false);
  }

  confirmSession() {
    this.closeSessionDrawer();
    this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Therapy session booked successfully' });
  }

  timeSlots = [
    '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM'
  ];
  
  doctors = this.bookingService.doctors;
  waitlist = this.bookingService.waitlist;

  async fillSlot(waitlistItem: any) {
    this.sessionForm.patient = waitlistItem.patient;
    this.showSessionDrawer.set(true);
    await this.bookingService.fillWaitlistSlot(waitlistItem.patient);
  }
}
