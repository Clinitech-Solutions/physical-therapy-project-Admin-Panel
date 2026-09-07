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

  // KPIs
  kpis = {
    todaysSessions: 24,
    presentDoctors: 6,
    walkInsToday: 3,
    pendingPayments: 5
  };

  clinicState = inject(ClinicStateService);
  messageService = inject(MessageService);
  
  sessions = this.clinicState.sessions;
  allPatients = this.clinicState.patients;
  allDoctors = this.clinicState.doctors;
  allRooms = this.clinicState.rooms;

  // Filters
  filterDoctor = signal<string>('');
  filterRoom = signal<string>('');
  searchPatient = signal<string>('');

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
