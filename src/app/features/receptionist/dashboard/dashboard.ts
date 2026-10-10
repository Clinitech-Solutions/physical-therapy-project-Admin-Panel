import { Component, inject, signal, computed, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { LanguageService } from "../../../core/services/language";
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';

import { ClinicStateService } from '../../../core/services/state/clinic-state.service';
import { AppointmentService, Appointment } from '../../../core/services/appointment.service';
import { PatientService } from '../../../core/services/patient.service';
import { MessageService } from 'primeng/api';
import { ProgressBar } from 'primeng/progressbar';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { PatientProfileComponent } from '../../../shared/components/patient-profile/patient-profile.component';

@Component({
  selector: "app-receptionist-dashboard",
  standalone: true,
  imports: [CommonModule, TranslateModule, FormsModule, ProgressBar, ButtonModule, TooltipModule, DialogModule, InputNumberModule, PatientProfileComponent],
  templateUrl: "./dashboard.html",
  styleUrl: "./dashboard.css",
})
export class Dashboard implements OnInit {
  langService = inject(LanguageService);
  clinicState = inject(ClinicStateService);
  appointmentService = inject(AppointmentService);
  patientService = inject(PatientService);
  messageService = inject(MessageService);
  
  todayDate = new Date();

  // Financial signals from ClinicStateService
  expectedTodayRevenue = this.clinicState.expectedTodayRevenue;
  collectedTodayRevenue = this.clinicState.collectedTodayRevenue;
  collectionRateToday = this.clinicState.collectionRateToday;

  appointments = this.appointmentService.appointments;
  allPatients = this.patientService.patients;
  allDoctors = this.clinicState.doctors;
  allRooms = this.clinicState.rooms;

  // Filters
  filterDoctor = signal<string>('');
  filterRoom = signal<string>('');
  searchPatient = signal<string>('');

  // Patient Profile Modal
  selectedProfilePatientId = signal<string | null>(null);
  showProfileModal = signal<boolean>(false);

  openPatientProfile(patientId: string | number) {
    this.selectedProfilePatientId.set(patientId.toString());
    this.showProfileModal.set(true);
  }

  ngOnInit() {
    this.appointmentService.getAppointments();
    this.patientService.getPatients().subscribe();
  }

  /**
   * Real-time computed signal: Filter clinicState.sessions() where date matches today
   */
  todaySessions = computed(() => {
    const today = new Date();
    const todayYMD = today.toISOString().split('T')[0];
    const pad = (n: number) => n.toString().padStart(2, '0');
    const localYMD = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    return this.appointments().filter(a => {
      if (!a.startTime) return false;
      const sessionDate = new Date(a.startTime);
      const isSameDay = !isNaN(sessionDate.getTime()) &&
        sessionDate.getFullYear() === today.getFullYear() &&
        sessionDate.getMonth() === today.getMonth() &&
        sessionDate.getDate() === today.getDate();
      const sessionDatePart = a.startTime.toString().split('T')[0];
      return isSameDay || sessionDatePart === todayYMD || sessionDatePart === localYMD;
    });
  });

  /**
   * Real-time computed signal: Count of todaySessions where status is 'Completed'
   */
  completedSessionsCount = computed(() =>
    this.todaySessions().filter(s => String(s.status) === 'Completed').length
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
  todayRevenue = computed(() => this.collectedTodayRevenue());

  /**
   * Filtered today's sessions for the timeline table (reactive computed signal)
   */
  filteredTodaySessions = computed(() => {
    const docFilter = this.filterDoctor().toLowerCase();
    const roomFilter = this.filterRoom().toLowerCase();
    const search = this.searchPatient().toLowerCase();

    return this.todaySessions().filter(session => {
      const docName = (session.doctorName || this.clinicState.getDoctorName(session.doctorId?.toString() || '')).toLowerCase();
      const roomName = (session.roomName || this.clinicState.getRoomName(session.roomId?.toString() || '')).toLowerCase();
      const patientName = (session.patientName || this.clinicState.getPatientName(session.patientId.toString())).toLowerCase();

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
      walkInsToday: this.todaySessions().filter(s => s.appointmentType === 'Assessment').length,
      pendingPayments: this.pendingPaymentsCount(),
      todayRevenue: this.todayRevenue()
    };
  }

  formatTime(isoString?: string) {
    if (!isoString) return '-';
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

  // Debt Gate State
  showDebtModal = false;
  debtSessionId: string | null = null;
  debtAmountToCollect = 0;
  pendingDebtTotal = 0;

  getSessionBadge(appointment: Appointment): string {
    const mockSession: any = {
      ...appointment,
      patientId: appointment.patientId?.toString(),
      type: appointment.appointmentType,
      scheduledAt: appointment.startTime
    };
    return this.clinicState.getSessionBadge(mockSession);
  }

  onCheckInClick(session: Appointment) {
    const patient = this.allPatients().find(p => p.id === session.patientId.toString());
    const debt = patient?.financialPlan?.remainingDebt || patient?.treatmentPlan?.financialPlan?.remainingDebt || 0;
    if (debt > 0) {
      this.pendingDebtTotal = debt;
      this.debtAmountToCollect = debt;
      this.debtSessionId = session.id?.toString() || null;
      this.showDebtModal = true;
    } else {
      if (session.id) this.checkIn(session.id);
    }
  }

  async confirmDebtPayment(collect: boolean) {
    if (collect && this.debtAmountToCollect > 0 && this.debtSessionId) {
      const session = this.appointments().find(s => s.id?.toString() === this.debtSessionId);
      if (session) {
        await this.clinicState.collectInstallment(session.patientId.toString(), this.debtAmountToCollect, 'Cash');
      }
    }
    if (this.debtSessionId) {
      this.checkIn(Number(this.debtSessionId));
    }
    this.showDebtModal = false;
    this.debtSessionId = null;
    this.debtAmountToCollect = 0;
    this.pendingDebtTotal = 0;
  }

  async checkIn(id: number) {
    try {
      await new Promise<void>((resolve, reject) => {
        this.appointmentService.updateStatus(id, 'In Progress').subscribe({
          next: () => resolve(),
          error: (e) => reject(e)
        });
      });
      this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Patient checked in' });
    } catch (e: any) {
      this.messageService.add({ severity: 'error', summary: 'Check-in Failed', detail: e.message || 'Room is not available for booking.' });
    }
  }

  async checkOut(id: number) {
    try {
      await new Promise<void>((resolve, reject) => {
        this.appointmentService.updateStatus(id, 'Completed').subscribe({
          next: () => resolve(),
          error: (e) => reject(e)
        });
      });
      this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Patient checked out' });
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Check-out Blocked',
        detail: error.message || 'Failed to check out'
      });
    }
  }

  markPatientAbsent(sessionId: number) {
    try {
      this.appointmentService.updateStatus(sessionId, 'Cancelled').subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Patient marked as absent and session cancelled.'
          });
        },
        error: (error) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: error.message || 'Failed to mark patient absent.'
          });
        }
      });
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: error.message || 'Failed to mark patient absent.'
      });
    }
  }
}

export { Dashboard as DashboardComponent };

