import { Component, inject, signal, computed, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { LanguageService } from "../../../core/services/language";
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { ClinicStateService } from '../../../core/services/state/clinic-state.service';
import { ReceptionistService, TodaySession } from '../../../core/services/receptionist.service';
import { PatientService } from '../../../core/services/patient.service';
import { BillingService } from '../../../core/services/billing.service';
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
  receptionistService = inject(ReceptionistService, { optional: true }) ?? new ReceptionistService();
  clinicState = inject(ClinicStateService);
  patientService = inject(PatientService, { optional: true });
  billingService = inject(BillingService, { optional: true }) ?? new BillingService();
  messageService = inject(MessageService);

  todayDate = new Date();

  // Bound strictly to ReceptionistService signals
  stats = this.receptionistService.stats;
  todaySessions = this.receptionistService.todaySessions;
  loading = this.receptionistService.loading;

  allPatients = computed(() => this.patientService?.patients() ?? []);
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

  ngOnInit(): void {
    this.receptionistService.getDashboardStats();
    this.receptionistService.getTodaySessions();
    this.patientService?.getPatients().subscribe();
    this.billingService.getInvoices();
  }

  onSearchChange(value: string): void {
    this.searchPatient.set(value);
    this.applySessionFilters();
  }

  onDoctorFilterChange(value: string): void {
    this.filterDoctor.set(value);
    this.applySessionFilters();
  }

  onRoomFilterChange(value: string): void {
    this.filterRoom.set(value);
    this.applySessionFilters();
  }

  private applySessionFilters(): void {
    const docId = this.filterDoctor();
    const roomId = this.filterRoom();
    const search = this.searchPatient().trim();

    this.receptionistService.getTodaySessions({
      search: search || undefined,
      doctorId: !isNaN(Number(docId)) && docId !== '' ? Number(docId) : undefined,
      roomId: !isNaN(Number(roomId)) && roomId !== '' ? Number(roomId) : undefined
    });
  }

  /**
   * Filtered today's sessions from receptionistService.todaySessions()
   */
  filteredTodaySessions = computed(() => {
    const docFilter = this.filterDoctor().toLowerCase();
    const roomFilter = this.filterRoom().toLowerCase();
    const search = this.searchPatient().toLowerCase();

    return this.todaySessions().filter((session) => {
      const docName = (
        session.doctorName ||
        this.clinicState.getDoctorName(session.doctorId?.toString() || '')
      ).toLowerCase();
      const roomName = (
        session.roomName ||
        this.clinicState.getRoomName(session.roomId?.toString() || '')
      ).toLowerCase();
      const patientName = (
        session.patientName ||
        this.getPatientName(session.patientId)
      ).toLowerCase();

      const matchDoc =
        !docFilter ||
        docName.includes(docFilter) ||
        String(session.doctorId ?? '').toLowerCase() === docFilter;
      const matchRoom =
        !roomFilter ||
        roomName.includes(roomFilter) ||
        String(session.roomId ?? '').toLowerCase() === roomFilter;
      const matchPatient = !search || patientName.includes(search);

      return matchDoc && matchRoom && matchPatient;
    });
  });

  getPatientName(patientId: string | number, fallbackName?: string): string {
    if (fallbackName) return fallbackName;
    const idStr = patientId != null ? patientId.toString() : '';
    const p = this.allPatients().find((pt) => pt.id === idStr);
    return p ? p.nameEn || p.nameAr || 'Unknown Patient' : this.clinicState.getPatientName(idStr);
  }

  getPatientAvatar(patientId: string | number, patientName?: string): string {
    const idStr = patientId != null ? patientId.toString() : '';
    const p = this.allPatients().find((pt) => pt.id === idStr);
    if (p?.avatar) return p.avatar;
    const resolvedName = patientName || this.clinicState.getPatientAvatar(idStr);
    if (resolvedName && resolvedName.length <= 2) return resolvedName;
    if (patientName) {
      return patientName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();
    }
    return 'PT';
  }

  formatTime(isoString?: string): string {
    if (!isoString) return '-';
    try {
      return new Date(isoString).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
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
      this.messageService.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Doctor marked absent'
      });
    }, 1000);
  }

  // Debt Gate State
  showDebtModal = false;
  debtSessionId: number | null = null;
  debtAmountToCollect = 0;
  pendingDebtTotal = 0;

  getSessionBadge(session: TodaySession): string {
    if (session.packageAlert) return session.packageAlert;
    if (session.sessionNumber && session.totalSessions) {
      return `Session ${session.sessionNumber} of ${session.totalSessions}`;
    }
    return '';
  }

  onCheckInClick(session: TodaySession) {
    const patient = this.allPatients().find(
      (p) => p.id === session.patientId?.toString()
    );
    const planDebt =
      patient?.financialPlan?.remainingDebt ||
      patient?.treatmentPlan?.financialPlan?.remainingDebt ||
      0;
    const unpaidInvoicesDebt = this.billingService
      .invoices()
      .filter((inv) => {
        const st = this.billingService.mapStatusToString(inv.status);
        return (
          Number(inv.patientId) === Number(session.patientId) &&
          (st === 'Pending' || st === 'Partial')
        );
      })
      .reduce(
        (sum, inv) => sum + (inv.remainingBalance ?? inv.patientAmount ?? 0),
        0
      );

    const debt = Math.max(planDebt, unpaidInvoicesDebt);
    if (debt > 0) {
      this.pendingDebtTotal = debt;
      this.debtAmountToCollect = debt;
      this.debtSessionId = Number(session.id);
      this.showDebtModal = true;
    } else {
      if (session.id !== undefined) this.checkIn(Number(session.id));
    }
  }

  async confirmDebtPayment(collect: boolean) {
    if (collect && this.debtAmountToCollect > 0 && this.debtSessionId !== null) {
      const session = this.todaySessions().find(
        (s) => Number(s.id) === this.debtSessionId
      );
      if (session) {
        let targetInvoice =
          this.billingService.getInvoiceBySessionId(this.debtSessionId) ||
          this.billingService
            .invoices()
            .find((inv) => {
              const st = this.billingService.mapStatusToString(inv.status);
              return (
                Number(inv.patientId) === Number(session.patientId) &&
                (st === 'Pending' || st === 'Partial')
              );
            });

        if (!targetInvoice) {
          targetInvoice = await firstValueFrom(
            this.billingService.createInvoice({
              appointmentId: this.debtSessionId,
              patientId: Number(session.patientId),
              type: this.billingService.mapTypeToNumber('Installment'),
              totalAmount: this.debtAmountToCollect,
              insuranceAmount: 0,
              patientAmount: this.debtAmountToCollect
            })
          );
        }

        if (targetInvoice?.id) {
          await firstValueFrom(
            this.billingService.recordPayment({
              invoiceId: Number(targetInvoice.id),
              amount: this.debtAmountToCollect,
              method: this.billingService.mapPaymentMethodToNumber('Cash')
            })
          );
        }
      }
    }
    if (this.debtSessionId !== null) {
      await this.checkIn(this.debtSessionId);
    }
    this.showDebtModal = false;
    this.debtSessionId = null;
    this.debtAmountToCollect = 0;
    this.pendingDebtTotal = 0;
  }

  /**
   * Check-In action wired to ReceptionistService.updateSessionStatus
   */
  async checkIn(appointmentId: number) {
    try {
      const inProgressStatus =
        this.receptionistService.mapStatusToNumber('In Progress');
      await firstValueFrom(
        this.receptionistService.updateSessionStatus(
          appointmentId,
          inProgressStatus
        )
      );
      this.messageService.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Patient checked in'
      });
    } catch (e: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Check-in Failed',
        detail: e?.message || 'Room is not available for booking.'
      });
    }
  }

  /**
   * Check-Out action wired to ReceptionistService.updateSessionStatus
   * (with BillingService payment gate check)
   */
  async checkOut(appointmentId: number) {
    try {
      const sessionInvoice =
        this.billingService.getInvoiceBySessionId(appointmentId);
      if (sessionInvoice) {
        const statusStr = this.billingService.mapStatusToString(
          sessionInvoice.status
        );
        if (statusStr !== 'Paid' && statusStr !== 'Waived') {
          throw new Error(
            'Cannot check out: The invoice for this session is pending. Please process payment first.'
          );
        }
      }

      const completedStatus =
        this.receptionistService.mapStatusToNumber('Completed');
      await firstValueFrom(
        this.receptionistService.updateSessionStatus(
          appointmentId,
          completedStatus
        )
      );
      this.messageService.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Patient checked out'
      });
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Check-out Blocked',
        detail: error?.message || 'Failed to check out'
      });
    }
  }

  /**
   * Cancel / Mark Absent action wired to ReceptionistService.cancelSession
   */
  cancelSession(appointmentId: number) {
    this.receptionistService.cancelSession(appointmentId).subscribe({
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
          detail: error?.message || 'Failed to cancel session.'
        });
      }
    });
  }

  markPatientAbsent(sessionId: number) {
    this.cancelSession(sessionId);
  }
}

export { Dashboard as DashboardComponent };
