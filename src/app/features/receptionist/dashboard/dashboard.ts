import { Component, inject, signal, computed } from "@angular/core";
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
   * Real-time computed signal: Filter clinicState.sessions() where date matches today
   */
  todaySessions = computed(() => {
    const today = new Date();
    const todayYMD = today.toISOString().split('T')[0];
    const pad = (n: number) => n.toString().padStart(2, '0');
    const localYMD = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    return this.clinicState.sessions().filter(s => {
      if (!s.scheduledAt) return false;
      const sessionDate = new Date(s.scheduledAt);
      const isSameDay = !isNaN(sessionDate.getTime()) &&
        sessionDate.getFullYear() === today.getFullYear() &&
        sessionDate.getMonth() === today.getMonth() &&
        sessionDate.getDate() === today.getDate();
      const sessionDatePart = s.scheduledAt.split('T')[0];
      return isSameDay || sessionDatePart === todayYMD || sessionDatePart === localYMD;
    });
  });

  /**
   * Real-time computed signal: Count of todaySessions where status is 'Completed'
   */
  completedSessionsCount = computed(() =>
    this.todaySessions().filter(s => s.status === 'Completed').length
  );

  /**
   * Real-time computed signal: Count of clinicState.invoices() where status is 'Pending'
   */
  pendingPaymentsCount = computed(() =>
    this.clinicState.invoices().filter(i => i.status === 'Pending').length
  );

  /**
   * Real-time computed signal: Sum the amount of all clinicState.invoices()
   * where status is 'Paid' AND the createdAt date matches today
   */
  todayRevenue = computed(() => {
    const today = new Date();
    const todayYMD = today.toISOString().split('T')[0];
    const pad = (n: number) => n.toString().padStart(2, '0');
    const localYMD = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    return this.clinicState.invoices()
      .filter(inv => {
        if (inv.status !== 'Paid' || !inv.createdAt) return false;
        const invDate = new Date(inv.createdAt);
        const isSameDay = !isNaN(invDate.getTime()) &&
          invDate.getFullYear() === today.getFullYear() &&
          invDate.getMonth() === today.getMonth() &&
          invDate.getDate() === today.getDate();
        const invDatePart = inv.createdAt.split('T')[0];
        return isSameDay || invDatePart === todayYMD || invDatePart === localYMD;
      })
      .reduce((sum, inv) => sum + (inv.amount || 0), 0);
  });

  /**
   * Filtered today's sessions for the timeline table (reactive computed signal)
   */
  filteredTodaySessions = computed(() => {
    const docFilter = this.filterDoctor().toLowerCase();
    const roomFilter = this.filterRoom().toLowerCase();
    const search = this.searchPatient().toLowerCase();

    return this.todaySessions().filter(session => {
      const docName = this.clinicState.getDoctorName(session.doctorId).toLowerCase();
      const roomName = this.clinicState.getRoomName(session.roomId).toLowerCase();
      const patientName = this.clinicState.getPatientName(session.patientId).toLowerCase();

      const matchDoc = !docFilter || docName.includes(docFilter);
      const matchRoom = !roomFilter || roomName.includes(roomFilter);
      const matchPatient = !search || patientName.includes(search);

      return matchDoc && matchRoom && matchPatient;
    });
  });

  // Live KPI stats bound directly to state signals
  get kpis() {
    return {
      todaysSessions: this.todaySessions().length,
      completedSessions: this.completedSessionsCount(),
      presentDoctors: this.clinicState.doctors().length,
      walkInsToday: this.todaySessions().filter(s => s.type === 'Assessment').length,
      pendingPayments: this.pendingPaymentsCount(),
      todayRevenue: this.todayRevenue()
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
    try {
      await this.clinicState.checkOutPatient(id);
      this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Patient checked out' });
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Check-out Blocked',
        detail: error.message
      });
    }
  }
}

export { Dashboard as DashboardComponent };

