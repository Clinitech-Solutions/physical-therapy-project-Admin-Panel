import { Component, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: "app-receptionist-bookings",
  standalone: true,
  imports: [CommonModule, TranslateModule, FormsModule],
  templateUrl: "./bookings.html",
  styleUrl: "./bookings.css"
})
export class BookingsComponent {
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
    alert('Assessment booked successfully');
  }

  openSessionDrawer() {
    this.showSessionDrawer.set(true);
  }

  closeSessionDrawer() {
    this.showSessionDrawer.set(false);
  }

  confirmSession() {
    this.closeSessionDrawer();
    alert('Therapy session booked successfully');
  }

  timeSlots = [
    '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM'
  ];
  
  doctors = [
    { name: 'Dr. Sarah', load: 1, room: 'Room 1' },
    { name: 'Dr. Omar', load: 2, room: 'Room 2' },
    { name: 'Dr. Youssef', load: 0, room: 'Room 3' }
  ];

  waitlist = signal([
    { patient: 'Youssef Ali', request: 'Any time today', contact: '+201112223344' },
    { patient: 'Sara Mahmoud', request: 'Morning (09:00 - 12:00)', contact: '+201011122233' }
  ]);

  fillSlot(waitlistItem: any) {
    this.sessionForm.patient = waitlistItem.patient;
    this.showSessionDrawer.set(true);
    this.waitlist.update(list => list.filter(item => item !== waitlistItem));
  }
}
