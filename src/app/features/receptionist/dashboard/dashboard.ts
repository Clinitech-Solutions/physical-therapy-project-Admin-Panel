import { Component, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { LanguageService } from "../../../core/services/language";
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';

import { ClinicStateService } from '../../../core/services/state/clinic-state.service';
import { Session } from '../../../core/models/session.model';
import { MessageService } from 'primeng/api';

@Component({
  selector: "app-receptionist-dashboard",
  standalone: true,
  imports: [CommonModule, TranslateModule, FormsModule],
  templateUrl: "./dashboard.html",
  styleUrl: "./dashboard.css",
})
export class Dashboard {
  langService = inject(LanguageService);
  clinicState = inject(ClinicStateService);
  messageService = inject(MessageService);
  
  todayDate = new Date();

  sessions = this.clinicState.sessions;
  allPatients = this.clinicState.patients;
  allDoctors = this.clinicState.doctors;
  allRooms = this.clinicState.rooms;

  // Filters
  filterDoctor = signal<string>('');
  filterRoom = signal<string>('');
  searchPatient = signal<string>('');

  /**
   * Strictly filters clinicState.sessions() to only include sessions
   * where the date part of scheduledAt matches today's date.
   */
  get todaySessions(): Session[] {
    const todayYMD = this.todayDate.toISOString().split('T')[0];
    const pad = (n: number) => n.toString().padStart(2, '0');
    const localYMD = `${this.todayDate.getFullYear()}-${pad(this.todayDate.getMonth() + 1)}-${pad(this.todayDate.getDate())}`;

    return this.sessions().filter(s => {
      if (!s.scheduledAt) return false;
      const sessionDatePart = s.scheduledAt.split('T')[0];
      return sessionDatePart === todayYMD || sessionDatePart === localYMD;
    });
  }

  /**
   * Filtered today's sessions for the timeline table
   */
  get filteredTodaySessions(): Session[] {
    const docFilter = this.filterDoctor().toLowerCase();
    const roomFilter = this.filterRoom().toLowerCase();
    const search = this.searchPatient().toLowerCase();

    return this.todaySessions.filter(session => {
      const docName = this.clinicState.getDoctorName(session.doctorId).toLowerCase();
      const roomName = this.clinicState.getRoomName(session.roomId).toLowerCase();
      const patientName = this.clinicState.getPatientName(session.patientId).toLowerCase();

      const matchDoc = !docFilter || docName.includes(docFilter);
      const matchRoom = !roomFilter || roomName.includes(roomFilter);
      const matchPatient = !search || patientName.includes(search);

      return matchDoc && matchRoom && matchPatient;
    });
  }

  // Live KPI stats bound directly to state signals
  get kpis() {
    return {
      todaysSessions: this.todaySessions.length,
      presentDoctors: this.clinicState.doctors().length,
      walkInsToday: this.todaySessions.filter(s => s.type === 'Assessment').length,
      pendingPayments: this.clinicState.invoices().filter(i => i.status === 'Pending').length
    };
  }

  formatTime(isoString: string) {
    try {
      return new Date(isoString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  }

  // Absence Modal State
  showAbsenceModal = signal(false);
  absentDoctorName = signal('');
  isProcessing = signal(false);
  
  openAbsenceModal(doctorName: string) {
    this.absentDoctorName.set(doctorName);
    this.showAbsenceModal.set(true);
  }

  closeAbsenceModal() {
    this.showAbsenceModal.set(false);
    this.absentDoctorName.set('');
  }

  confirmCoverage() {
    this.isProcessing.set(true);
    setTimeout(() => {
      this.isProcessing.set(false);
      this.closeAbsenceModal();
      this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Doctor marked absent' });
    }, 1000);
  }

  async checkIn(id: string) {
    try {
      await this.clinicState.checkInPatient(id);
      this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Patient checked in' });
    } catch (e: any) {
      this.messageService.add({ severity: 'error', summary: 'Check-in Failed', detail: e.message || 'Room is not available for booking.' });
    }
  }

  async checkOut(id: string) {
    await this.clinicState.checkOutPatient(id);
    this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Patient checked out' });
  }
}
