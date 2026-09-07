import { Component, signal, computed, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { ClinicStateService } from '../../../core/services/state/clinic-state.service';
import { MessageService } from 'primeng/api';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { SessionType } from '../../../core/models/session.model';
import { Doctor } from '../../../core/models/doctor.model';
import { Patient } from '../../../core/models/patient.model';

@Component({
  selector: "app-receptionist-bookings",
  standalone: true,
  imports: [
    CommonModule, 
    TranslateModule, 
    FormsModule, 
    SelectModule, 
    DatePickerModule, 
    DialogModule
  ],
  templateUrl: "./bookings.html",
  styleUrls: ["./bookings.css"]
})
export class BookingsComponent {
  clinicState = inject(ClinicStateService);
  messageService = inject(MessageService);

  viewMode = signal<'Week' | 'Day'>('Day');
  isLoading = this.clinicState.isLoading;

  // Global State Signals from ClinicStateService
  waitlist = this.clinicState.waitlist;
  sessions = this.clinicState.sessions;
  allPatients = this.clinicState.patients;
  allDoctors = this.clinicState.doctors;
  allRooms = this.clinicState.rooms;
  availableRooms = this.clinicState.availableRooms;

  // Unified Booking State Variables
  selectedPatientId: string = '';
  selectedDoctorId: string = '';
  selectedRoomId: string = '';
  sessionType: SessionType = 'Assessment';
  scheduledDate: Date | null = new Date();

  // Session type options
  sessionTypeOptions: { label: string; value: SessionType }[] = [
    { label: 'Assessment', value: 'Assessment' },
    { label: 'Session', value: 'Session' }
  ];

  // Quick Add Patient Modal State
  isQuickAddModalOpen = false;
  quickPatient = {
    nameEn: '',
    nameAr: '',
    phone: '',
    gender: 'Male' as 'Male' | 'Female',
    paymentType: 'Cash' as 'Cash' | 'Online' | 'Insurance'
  };

  // Assessment First: computed / getter
  get isNewPatient(): boolean {
    return this.selectedPatientId ? this.clinicState.isPatientNew(this.selectedPatientId) : false;
  }

  // Selected Patient entity helper
  get selectedPatient(): Patient | undefined {
    return this.allPatients().find(p => p.id === this.selectedPatientId);
  }

  /**
   * Strict Gender Matching Rule:
   * Male doctors treat male patients, and female doctors treat female patients.
   * Only returns doctors whose gender matches the selected patient's gender.
   */
  get filteredDoctors(): Doctor[] {
    if (!this.selectedPatientId) {
      return [];
    }
    const patientGender = this.clinicState.getPatientGender(this.selectedPatientId);
    if (!patientGender) {
      return [];
    }
    return this.allDoctors().filter(doc => doc.gender === patientGender);
  }

  // Patient selection change handler
  onPatientChange(patientId?: string) {
    if (patientId !== undefined) {
      this.selectedPatientId = patientId;
    }

    // Business Rule 1: If patient is new, automatically set sessionType = 'Assessment'
    if (this.isNewPatient) {
      this.sessionType = 'Assessment';
    }

    // Business Rule 2 (Gender Matching):
    // When selectedPatientId changes, reset selectedDoctorId if it does not match patient's gender
    if (this.selectedDoctorId) {
      const isDocValid = this.filteredDoctors.some(d => d.id === this.selectedDoctorId);
      if (!isDocValid) {
        this.selectedDoctorId = '';
      }
    }
  }

  /**
   * Walk-in / Nearest Slot Handler:
   * Strictly searches within filteredDoctors (gender-matched candidates only).
   */
  handleWalkInNearestSlot() {
    if (!this.selectedPatientId) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Select Patient',
        detail: 'Please select or add a patient first to find the nearest walk-in slot.'
      });
      return;
    }

    // Strict Gender Matching: Must only search within filteredDoctors
    const eligibleDoctors = this.filteredDoctors;
    if (!eligibleDoctors || eligibleDoctors.length === 0) {
      const patientGender = this.clinicState.getPatientGender(this.selectedPatientId);
      this.messageService.add({
        severity: 'error',
        summary: 'No Matching Doctors',
        detail: `No available ${patientGender ? patientGender.toLowerCase() : ''} doctors found to treat this patient.`
      });
      return;
    }

    try {
      // Find nearest slot strictly constrained to candidate filteredDoctors
      const slot = this.clinicState.findNearestSlot(this.selectedPatientId, eligibleDoctors);
      this.selectedDoctorId = slot.doctorId;
      this.selectedRoomId = slot.roomId;
      this.scheduledDate = new Date(slot.scheduledAt);

      if (this.isNewPatient) {
        this.sessionType = 'Assessment';
      }

      this.messageService.add({
        severity: 'success',
        summary: 'Walk-In Slot Found',
        detail: `Auto-assigned Dr. ${this.clinicState.getDoctorName(slot.doctorId)} (${this.clinicState.getDoctorGender(slot.doctorId)}) in ${this.clinicState.getRoomName(slot.roomId)} at ${this.formatTime(slot.scheduledAt)}.`
      });
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Slot Search Failed',
        detail: error.message || 'No suitable slot found matching gender and load criteria.'
      });
    }
  }

  // Book Session Submission
  async submitBooking() {
    if (!this.selectedPatientId) {
      this.messageService.add({ severity: 'error', summary: 'Validation Error', detail: 'Please select a patient.' });
      return;
    }
    if (!this.selectedDoctorId) {
      this.messageService.add({ severity: 'error', summary: 'Validation Error', detail: 'Please select a doctor.' });
      return;
    }
    if (!this.selectedRoomId) {
      this.messageService.add({ severity: 'error', summary: 'Validation Error', detail: 'Please select an available room.' });
      return;
    }
    if (!this.scheduledDate) {
      this.messageService.add({ severity: 'error', summary: 'Validation Error', detail: 'Please select date and time.' });
      return;
    }

    // Business Rule Enforcement: Doctor MUST be from filteredDoctors (strict gender match)
    const isDocGenderValid = this.filteredDoctors.some(d => d.id === this.selectedDoctorId);
    if (!isDocGenderValid) {
      const patientGender = this.clinicState.getPatientGender(this.selectedPatientId);
      this.messageService.add({
        severity: 'error',
        summary: 'Gender Mismatch',
        detail: `Strict policy: Male doctors treat male patients, and female doctors treat female patients. Please select a ${patientGender?.toLowerCase()} doctor.`
      });
      return;
    }

    // Enforce Assessment First rule
    const finalType: SessionType = this.isNewPatient ? 'Assessment' : this.sessionType;

    const dateObj = this.scheduledDate instanceof Date ? this.scheduledDate : new Date(this.scheduledDate);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const scheduledIso = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}T${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}:00`;

    try {
      await this.clinicState.addSession({
        patientId: this.selectedPatientId,
        doctorId: this.selectedDoctorId,
        roomId: this.selectedRoomId,
        scheduledAt: scheduledIso,
        type: finalType
      });

      this.messageService.add({
        severity: 'success',
        summary: 'Booking Successful',
        detail: `${finalType} booked for ${this.clinicState.getPatientName(this.selectedPatientId)} with Dr. ${this.clinicState.getDoctorName(this.selectedDoctorId)}!`
      });

      this.resetBookingForm();
    } catch (e: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Booking Failed',
        detail: e.message || 'Room is not available for booking.'
      });
    }
  }

  resetBookingForm() {
    this.selectedPatientId = '';
    this.selectedDoctorId = '';
    this.selectedRoomId = '';
    this.sessionType = 'Assessment';
    this.scheduledDate = new Date();
  }

  // Quick Add Patient Modal
  openQuickAddModal() {
    this.quickPatient = {
      nameEn: '',
      nameAr: '',
      phone: '',
      gender: 'Male',
      paymentType: 'Cash'
    };
    this.isQuickAddModalOpen = true;
  }

  closeQuickAddModal() {
    this.isQuickAddModalOpen = false;
  }

  async saveQuickPatient() {
    if (!this.quickPatient.nameEn.trim() || !this.quickPatient.phone.trim()) {
      this.messageService.add({
        severity: 'error',
        summary: 'Required Fields',
        detail: 'Please enter patient name and phone number.'
      });
      return;
    }

    await this.clinicState.createPatient({
      nameEn: this.quickPatient.nameEn.trim(),
      nameAr: this.quickPatient.nameAr.trim() || this.quickPatient.nameEn.trim(),
      phone: this.quickPatient.phone.trim(),
      gender: this.quickPatient.gender,
      paymentType: this.quickPatient.paymentType,
      dob: '1995-01-01',
      insuranceCompany: '',
      docs: {
        medicalConsent: true,
        liabilityWaiver: true,
        idCard: true
      }
    });

    // Auto-select newly created patient
    const newPatient = this.allPatients()[0];
    if (newPatient) {
      this.selectedPatientId = newPatient.id;
      this.onPatientChange(newPatient.id);
    }

    this.closeQuickAddModal();
    this.messageService.add({
      severity: 'success',
      summary: 'Patient Registered',
      detail: 'New patient created and selected.'
    });
  }

  // Fill Slot from Waitlist
  fillWaitlist(patientId: string) {
    this.selectedPatientId = patientId;
    this.onPatientChange(patientId);
    this.handleWalkInNearestSlot();
  }

  // Calendar & Schedule Grid
  timeSlots = [
    '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM'
  ];

  formatTime(isoString: string) {
    try {
      return new Date(isoString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  }

  calendarGrid = computed(() => {
    const s = this.sessions();
    const grid: { time: string, sessions: any[] }[] = this.timeSlots.map(t => ({ time: t, sessions: [] }));
    s.forEach(session => {
      const timeStr = this.formatTime(session.scheduledAt);
      const slot = grid.find(g => g.time === timeStr);
      if (slot) {
        slot.sessions.push(session);
      }
    });
    return grid;
  });
}
