import { Component, inject, signal, computed, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { LanguageService } from "../../../core/services/language";
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { ClinicStateService } from '../../../core/services/state/clinic-state.service';
import { AppointmentService, Appointment } from '../../../core/services/appointment.service';
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
  clinicState = inject(ClinicStateService);
  appointmentService = inject(AppointmentService, { optional: true });
  patientService = inject(PatientService, { optional: true });
  billingService = inject(BillingService, { optional: true }) ?? new BillingService();
  messageService = inject(MessageService);
  
  todayDate = new Date();

  // Financial signals strictly bound to BillingService
  expectedTodayRevenue = this.billingService.expectedTodayRevenue;
  collectedTodayRevenue = this.billingService.collectedTodayRevenue;
  collectionRateToday = this.billingService.collectionRateToday;

  appointments = computed<Appointment[]>(() => {
    const apiApps = this.appointmentService?.appointments() ?? [];
    if (apiApps.length > 0) return apiApps;
    return this.clinicState.sessions().map((s) => ({
      id: Number(s.id) || (s.id as any),
      patientId: Number(s.patientId) || (s.patientId as any),
      doctorId: (s.doctorId as any) ?? null,
      roomId: (s.roomId as any) ?? null,
      appointmentType: s.type,
      startTime: s.scheduledAt || '',
      endTime: s.scheduledAt || '',
      status: s.status,
      scheduledAt: s.scheduledAt
    })) as any[];
  });

  allPatients = computed(() => {
    const apiPatients = this.patientService?.patients() ?? [];
    return apiPatients.length > 0 ? apiPatients : this.clinicState.patients();
  });

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
    this.appointmentService?.getAppointments();
    this.patientService?.getPatients().subscribe();
    this.billingService.getInvoices();
  }

  /**
   * Real-time computed signal: Filter appointments/sessions where date matches today
   */
  todaySessions = computed(() => {
    const today = new Date();
    const todayYMD = today.toISOString().split('T')[0];
    const pad = (n: number) => n.toString().padStart(2, '0');
    const localYMD = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    return this.appointments().filter((a: any) => {
      const timeVal = a.startTime || a.scheduledAt;
      if (!timeVal) return false;
      const sessionDate = new Date(timeVal);
      const isSameDay = !isNaN(sessionDate.getTime()) &&
        sessionDate.getFullYear() === today.getFullYear() &&
        sessionDate.getMonth() === today.getMonth() &&
        sessionDate.getDate() === today.getDate();
      const sessionDatePart = timeVal.toString().split('T')[0];
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
   * Real-time computed signal: Strictly bound to billingService.pendingPaymentsCount
   */
  pendingPaymentsCount = this.billingService.pendingPaymentsCount;

  /**
   * Real-time computed signal: Strictly bound to billingService.collectedTodayRevenue
   */
  todayRevenue = computed(() => this.billingService.collectedTodayRevenue());

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
    const planDebt = patient?.financialPlan?.remainingDebt || patient?.treatmentPlan?.financialPlan?.remainingDebt || 0;
    const unpaidInvoicesDebt = this.billingService
      .invoices()
      .filter((inv) => {
        const st = this.billingService.mapStatusToString(inv.status);
        return (
          Number(inv.patientId) === Number(session.patientId) &&
          (st === 'Pending' || st === 'Partial')
        );
      })
      .reduce((sum, inv) => sum + (inv.remainingBalance ?? inv.patientAmount ?? 0), 0);

    const debt = Math.max(planDebt, unpaidInvoicesDebt);
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
              appointmentId: Number(this.debtSessionId),
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
      if (this.appointmentService) {
        await new Promise<void>((resolve, reject) => {
          this.appointmentService!.updateStatus(id, 'In Progress').subscribe({
            next: () => resolve(),
            error: (e) => reject(e)
          });
        });
      }
      this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Patient checked in' });
    } catch (e: any) {
      this.messageService.add({ severity: 'error', summary: 'Check-in Failed', detail: e.message || 'Room is not available for booking.' });
    }
  }

  async checkOut(id: number) {
    try {
      const sessionInvoice = this.billingService.getInvoiceBySessionId(id);
      if (sessionInvoice) {
        const statusStr = this.billingService.mapStatusToString(sessionInvoice.status);
        if (statusStr !== 'Paid' && statusStr !== 'Waived') {
          throw new Error(
            'Cannot check out: The invoice for this session is pending. Please process payment first.'
          );
        }
      }

      if (this.appointmentService) {
        await new Promise<void>((resolve, reject) => {
          this.appointmentService!.updateStatus(id, 'Completed').subscribe({
            next: () => resolve(),
            error: (e) => reject(e)
          });
        });
      }
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
      this.appointmentService?.updateStatus(sessionId, 'Cancelled').subscribe({
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
