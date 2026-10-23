import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ClinicStateService } from '../../../core/services/state/clinic-state.service';
import { MessageService } from 'primeng/api';
import { SelectModule } from 'primeng/select';
import { DialogModule } from 'primeng/dialog';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { InputNumberModule } from 'primeng/inputnumber';
import { Doctor } from '../../../core/models/doctor.model';
import { Patient } from '../../../core/models/patient.model';
import { PatientProfileComponent } from '../../../shared/components/patient-profile/patient-profile.component';
import { AppointmentService, Appointment } from '../../../core/services/appointment.service';
import { PatientService } from '../../../core/services/patient.service';
import { BillingService } from '../../../core/services/billing.service';

@Component({
  selector: 'app-receptionist-schedule',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    FormsModule,
    SelectModule,
    DialogModule,
    SelectButtonModule,
    ButtonModule,
    TooltipModule,
    InputNumberModule,
    PatientProfileComponent
  ],
  templateUrl: './schedule.html',
  styleUrls: ['./schedule.css']
})
export class ScheduleComponent implements OnInit {
  clinicState = inject(ClinicStateService);
  messageService = inject(MessageService);
  appointmentService = inject(AppointmentService, { optional: true })!;
  patientService = inject(PatientService, { optional: true })!;
  billingService = inject(BillingService, { optional: true }) ?? new BillingService();

  viewMode = signal<'Week' | 'Day'>('Day');
  isLoading = this.appointmentService?.loading ?? this.clinicState.isLoading;

  // Global State Signals
  appointments = this.appointmentService?.appointments ?? signal<Appointment[]>([]);
  allPatients = this.patientService?.patients ?? this.clinicState.patients;
  allDoctors = this.clinicState.doctors;
  allRooms = this.clinicState.rooms;

  // Search & Filter Controls
  searchQuery: string = '';
  selectedDoctorFilter: string = '';
  selectedRoomFilter: string = '';
  selectedFilter: 'All' | 'Upcoming' | 'In Progress' | 'Completed' = 'All';

  filterOptions = [
    { label: 'All', value: 'All', icon: 'bi bi-grid-fill' },
    { label: 'Upcoming', value: 'Upcoming', icon: 'bi bi-clock' },
    { label: 'In Progress', value: 'In Progress', icon: 'bi bi-play-circle-fill' },
    { label: 'Completed', value: 'Completed', icon: 'bi bi-check-circle-fill' }
  ];

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

  // Timeline slots
  timeSlots = [
    '08:00 AM',
    '09:00 AM',
    '10:00 AM',
    '11:00 AM',
    '12:00 PM',
    '01:00 PM',
    '02:00 PM',
    '03:00 PM'
  ];

  todayDate = new Date();

  formatTime(isoString?: string) {
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

  /**
   * Strictly filters sessions/appointments to only include sessions
   * where the date part matches today's date.
   */
  get todaySessions(): Appointment[] {
    const todayYMD = this.todayDate.toISOString().split('T')[0];
    const pad = (n: number) => n.toString().padStart(2, '0');
    const localYMD = `${this.todayDate.getFullYear()}-${pad(this.todayDate.getMonth() + 1)}-${pad(this.todayDate.getDate())}`;

    const apiApps = this.appointments();
    const source: Appointment[] =
      apiApps.length > 0
        ? apiApps
        : (this.clinicState.sessions().map((s) => ({
            id: s.id as any,
            patientId: s.patientId as any,
            doctorId: s.doctorId as any,
            roomId: s.roomId as any,
            appointmentType: s.type,
            startTime: s.scheduledAt || '',
            endTime: s.scheduledAt || '',
            status: s.status
          })) as Appointment[]);

    return source.filter((a) => {
      if (!a.startTime) return false;
      const sessionDatePart = a.startTime.toString().split('T')[0];
      return sessionDatePart === todayYMD || sessionDatePart === localYMD;
    });
  }

  // Summary KPI getters for Today's Schedule
  get totalTodayCount(): number {
    return this.todaySessions.length;
  }

  get upcomingCount(): number {
    return this.todaySessions.filter(
      (s) => String(s.status) === 'Pending' || String(s.status) === 'Confirmed'
    ).length;
  }

  get inProgressCount(): number {
    return this.todaySessions.filter((s) => String(s.status) === 'In Progress').length;
  }

  get completedCount(): number {
    return this.todaySessions.filter((s) => String(s.status) === 'Completed').length;
  }

  /**
   * Schedule Filter:
   * Filters today's sessions based on selectedFilter, searchQuery, doctor, and room.
   */
  get filteredSchedule(): { time: string; sessions: Appointment[] }[] {
    const all = this.todaySessions;
    let filtered = all;

    if (this.selectedFilter === 'Upcoming') {
      filtered = filtered.filter(
        (s) => String(s.status) === 'Pending' || String(s.status) === 'Confirmed'
      );
    } else if (this.selectedFilter === 'In Progress') {
      filtered = filtered.filter((s) => String(s.status) === 'In Progress');
    } else if (this.selectedFilter === 'Completed') {
      filtered = filtered.filter((s) => String(s.status) === 'Completed');
    }

    if (this.selectedDoctorFilter) {
      filtered = filtered.filter(
        (s) => String(s.doctorId) === String(this.selectedDoctorFilter)
      );
    }

    if (this.selectedRoomFilter) {
      filtered = filtered.filter(
        (s) => String(s.roomId) === String(this.selectedRoomFilter)
      );
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      filtered = filtered.filter((s) => {
        const pName = (
          s.patientName ||
          this.clinicState.getPatientName(s.patientId?.toString() || '') ||
          ''
        ).toLowerCase();
        const dName = (
          s.doctorName ||
          this.clinicState.getDoctorName(s.doctorId?.toString() || '') ||
          ''
        ).toLowerCase();
        return pName.includes(q) || dName.includes(q);
      });
    }

    const grid: { time: string; sessions: Appointment[] }[] = this.timeSlots.map((t) => ({
      time: t,
      sessions: []
    }));

    filtered.forEach((session) => {
      if (!session.startTime) return;
      let slot = grid.find((g) => g.time === this.formatTime(session.startTime as string));
      if (!slot) {
        try {
          const d = new Date(session.startTime);
          d.setMinutes(0, 0, 0);
          const hourStr = d.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
          });
          slot = grid.find((g) => g.time === hourStr);
        } catch {}
      }
      if (slot) {
        slot.sessions.push(session);
      }
    });
    return grid;
  }

  resetFilters() {
    this.searchQuery = '';
    this.selectedDoctorFilter = '';
    this.selectedRoomFilter = '';
    this.selectedFilter = 'All';
  }

  getPatientInitials(session: Appointment): string {
    const name =
      session.patientName ||
      this.clinicState.getPatientName(session.patientId?.toString() || '') ||
      'P';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }

  getSessionBadge(appointment: Appointment): string {
    const mockSession: any = {
      ...appointment,
      patientId: appointment.patientId?.toString(),
      type: appointment.appointmentType,
      scheduledAt: appointment.startTime
    };
    return this.clinicState.getSessionBadge(mockSession);
  }

  getStatusClass(status: string | number): string {
    const strStatus = String(status);
    switch (strStatus) {
      case 'Completed':
        return 'status-completed';
      case 'In Progress':
        return 'status-in-progress';
      case 'Pending':
        return 'status-pending';
      case 'Confirmed':
        return 'status-confirmed';
      case 'Cancelled':
        return 'status-cancelled';
      default:
        return 'status-confirmed';
    }
  }

  // Doctor Absence Reporting State
  showAbsenceModal = false;
  absentDoctorId: string | null = null;
  coveringSeniorId: string | null = null;

  getDoctorGender(doctorId: string | null): string {
    return this.clinicState.getDoctorGender(doctorId);
  }

  get coveringSeniors(): Doctor[] {
    if (!this.absentDoctorId) {
      return [];
    }
    const absentGender = this.getDoctorGender(this.absentDoctorId);
    if (!absentGender) {
      return [];
    }
    return this.allDoctors().filter(
      (doc) => doc.id !== this.absentDoctorId && doc.gender === absentGender
    );
  }

  onAbsentDoctorChange() {
    if (this.coveringSeniorId) {
      const isValid = this.coveringSeniors.some((d) => d.id === this.coveringSeniorId);
      if (!isValid) {
        this.coveringSeniorId = null;
      }
    }
  }

  confirmAbsence() {
    if (!this.absentDoctorId || !this.coveringSeniorId) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Incomplete Selection',
        detail: 'Please select both an absent doctor and a covering senior doctor.'
      });
      return;
    }

    try {
      this.clinicState.handleDoctorAbsence(this.absentDoctorId, this.coveringSeniorId);
      this.messageService.add({
        severity: 'success',
        summary: 'Absence Recorded',
        detail:
          'Absence recorded. 50% of sessions reassigned to Senior, remainder distributed to available doctors.'
      });
      this.closeAbsenceModal();
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Absence Error',
        detail: error?.message || 'Failed to record doctor absence.'
      });
    }
  }

  closeAbsenceModal() {
    this.showAbsenceModal = false;
    this.absentDoctorId = null;
    this.coveringSeniorId = null;
  }

  /**
   * Check-in patient action with Debt Gate interceptor
   */
  showDebtModal = false;
  pendingCheckInSessionId: number | null = null;
  installmentAmount: number = 0;
  installmentPaymentMethod: string = 'Cash';
  paymentMethods = ['Cash', 'Credit Card', 'E-Wallet', 'InstaPay'];
  debtAmount: number = 0;

  async checkInSession(sessionId: number | undefined) {
    if (sessionId === undefined) return;
    const session = this.appointments().find((s) => s.id === sessionId) ||
      this.todaySessions.find((s) => s.id === sessionId);
    if (!session) return;

    const patient =
      this.allPatients().find((p) => p.id === session.patientId.toString()) ||
      this.clinicState.getPatientById(session.patientId.toString());
    const plan = patient?.financialPlan || patient?.treatmentPlan?.financialPlan;

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

    const totalOutstandingDebt = Math.max(
      plan?.remainingDebt ?? 0,
      unpaidInvoicesDebt
    );

    if (totalOutstandingDebt > 0) {
      this.debtAmount = totalOutstandingDebt;
      this.pendingCheckInSessionId = sessionId;
      this.installmentAmount = totalOutstandingDebt;
      this.installmentPaymentMethod = 'Cash';
      this.showDebtModal = true;
      return;
    }

    await this.executeCheckIn(sessionId);
  }

  async executeCheckIn(sessionId: number) {
    try {
      await new Promise<void>((resolve, reject) => {
        this.appointmentService.updateStatus(sessionId, 'In Progress').subscribe({
          next: () => resolve(),
          error: (e) => reject(e)
        });
      });
      this.messageService.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Patient checked in'
      });
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Check-in Error',
        detail: error?.message || 'Check-in failed'
      });
    }
  }

  async confirmCheckIn(withInstallment: boolean) {
    if (this.pendingCheckInSessionId === null) return;
    const sessionId = this.pendingCheckInSessionId;

    const session =
      this.appointments().find((s) => s.id === sessionId) ||
      this.todaySessions.find((s) => s.id === sessionId);
    if (!session) return;

    if (withInstallment && this.installmentAmount > 0) {
      try {
        const methodNum = this.billingService.mapPaymentMethodToNumber(
          this.installmentPaymentMethod
        );

        let targetInvoice =
          this.billingService.getInvoiceBySessionId(sessionId) ||
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
              appointmentId: sessionId,
              patientId: Number(session.patientId),
              type: this.billingService.mapTypeToNumber('Installment'),
              totalAmount: this.installmentAmount,
              insuranceAmount: 0,
              patientAmount: this.installmentAmount
            })
          );
        }

        if (targetInvoice?.id) {
          await firstValueFrom(
            this.billingService.recordPayment({
              invoiceId: Number(targetInvoice.id),
              amount: this.installmentAmount,
              method: methodNum
            })
          );
        }

        this.messageService.add({
          severity: 'success',
          summary: 'Payment Collected',
          detail: `${this.installmentAmount} EGP installment collected.`
        });
      } catch (error: any) {
        this.messageService.add({
          severity: 'error',
          summary: 'Payment Error',
          detail: 'Failed to process installment'
        });
        return;
      }
    }

    this.showDebtModal = false;
    this.pendingCheckInSessionId = null;
    await this.executeCheckIn(sessionId);
  }

  /**
   * Check-out Gate:
   * Strictly checks BillingService.getInvoiceBySessionId(sessionId) and halts
   * if the invoice status is not 'Paid' or 'Waived'.
   */
  async checkoutSession(sessionId: number | undefined) {
    if (sessionId === undefined) return;
    try {
      const sessionInvoice = this.billingService.getInvoiceBySessionId(sessionId);
      if (sessionInvoice) {
        const statusStr = this.billingService.mapStatusToString(sessionInvoice.status);
        if (statusStr !== 'Paid' && statusStr !== 'Waived') {
          throw new Error(
            'Cannot check out: The invoice for this session is pending. Please process payment first.'
          );
        }
      }

      await new Promise<void>((resolve, reject) => {
        this.appointmentService.updateStatus(sessionId, 'Completed').subscribe({
          next: () => resolve(),
          error: (e) => reject(e)
        });
      });
      this.messageService.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Patient checked out'
      });
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Check-out Blocked',
        detail: error.message || 'Failed to check out'
      });
    }
  }

  markPatientAbsent(sessionId: number | undefined) {
    if (sessionId === undefined) return;
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
