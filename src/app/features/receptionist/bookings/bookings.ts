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
import { SessionType } from '../../../core/models/session.model';

@Component({
  selector: "app-receptionist-bookings",
  standalone: true,
  imports: [CommonModule, TranslateModule, FormsModule, SelectModule],
  templateUrl: "./bookings.html"
})
export class BookingsComponent {
  bookingService = inject(BookingService);
  patientService = inject(PatientService);
  doctorService = inject(DoctorService);
  roomService = inject(RoomService);
  messageService = inject(MessageService);

  viewMode = signal<'Week' | 'Day'>('Day');
  isLoading = this.bookingService.loading;

  // Global State
  waitlist = this.bookingService.waitlist;
  doctors = this.bookingService.doctors;
  sessions = this.bookingService.sessions;
  allPatients = this.patientService.patients;
  allDoctors = this.doctorService.doctors;
  allRooms = this.roomService.rooms;

  timeSlots = [
    '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM'
  ];

  // Helper functions for UI resolution
  getPatient(id: string) {
    return this.allPatients().find(p => p.id === id);
  }
  
  getDoctor(id: string) {
    return this.allDoctors().find(d => d.id === id);
  }

  getRoom(id: string) {
    return this.allRooms().find(r => r.id === id);
  }
  
  // Format ISO time to short time string (e.g. 09:00 AM)
  formatTime(isoString: string) {
    try {
      return new Date(isoString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  }

  // Dynamic grid state
  calendarGrid = computed(() => {
    const s = this.sessions();
    const grid: { [time: string]: any[] } = {};
    this.timeSlots.forEach(t => grid[t] = []);
    s.forEach(session => {
      // Map scheduledAt back to a slot string for the UI grid for now
      const timeStr = this.formatTime(session.scheduledAt);
      if (grid[timeStr]) {
        grid[timeStr].push(session);
      }
    });
    return grid;
  });

  // Drawer States
  isAssessmentDrawerOpen = signal(false);
  isSessionDrawerOpen = signal(false);

  // Forms
  assessmentForm = {
    patientId: '',
    doctorId: '',
    date: '',
    time: ''
  };

  sessionForm = {
    patientId: '',
    doctorId: '',
    roomId: '',
    date: '',
    time: ''
  };

  openAssessmentDrawer() {
    this.isAssessmentDrawerOpen.set(true);
  }

  closeAssessmentDrawer() {
    this.isAssessmentDrawerOpen.set(false);
    this.assessmentForm = { patientId: '', doctorId: '', date: '', time: '' };
  }

  openSessionDrawer() {
    this.isSessionDrawerOpen.set(true);
  }

  closeSessionDrawer() {
    this.isSessionDrawerOpen.set(false);
    this.sessionForm = { patientId: '', doctorId: '', roomId: '', date: '', time: '' };
  }

  fillWaitlist(patientId: string) {
    this.sessionForm.patientId = patientId;
    this.openSessionDrawer();
  }

  // Form submission handlers
  async submitAssessment() {
    if (!this.assessmentForm.patientId || !this.assessmentForm.doctorId || !this.assessmentForm.time) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Please fill all required fields.' });
      return;
    }

    // Dummy logic to convert time back to a pseudo ISO string for the mock DB today
    const mockIso = `2026-05-12T${this.assessmentForm.time === '09:00 AM' ? '09:00:00' : '10:00:00'}Z`;

    await this.bookingService.addSession({
      patientId: this.assessmentForm.patientId,
      doctorId: this.assessmentForm.doctorId,
      roomId: 'room_1', // Default assigned room for mock
      scheduledAt: mockIso,
      type: 'Assessment' as SessionType
    });

    this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Assessment booked successfully!' });
    this.closeAssessmentDrawer();
  }

  async submitSession() {
    if (!this.sessionForm.patientId || !this.sessionForm.doctorId || !this.sessionForm.roomId || !this.sessionForm.time) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Please fill all required fields.' });
      return;
    }

    const mockIso = `2026-05-12T${this.sessionForm.time === '09:00 AM' ? '09:00:00' : '10:00:00'}Z`;

    await this.bookingService.addSession({
      patientId: this.sessionForm.patientId,
      doctorId: this.sessionForm.doctorId,
      roomId: this.sessionForm.roomId,
      scheduledAt: mockIso,
      type: 'Session' as SessionType
    });

    this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Session booked successfully!' });
    this.closeSessionDrawer();
  }
}
