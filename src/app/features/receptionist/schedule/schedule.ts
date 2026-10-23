import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MessageService } from 'primeng/api';
import { SelectModule } from 'primeng/select';
import { DialogModule } from 'primeng/dialog';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { InputNumberModule } from 'primeng/inputnumber';
import { Patient } from '../../../core/models/patient.model';
import { PatientProfileComponent } from '../../../shared/components/patient-profile/patient-profile.component';
import {
  ReceptionistService,
  TodaySession
} from '../../../core/services/receptionist.service';
import { AppointmentService } from '../../../core/services/appointment.service';
import { PatientService } from '../../../core/services/patient.service';
import { BillingService } from '../../../core/services/billing.service';
import { UserService } from '../../../core/services/user.service';

export interface ScheduleDoctorOption {
  id: string;
  name: string;
  gender?: string;
}

export interface ScheduleRoomOption {
  id: string;
  displayName: string;
}

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
  messageService = inject(MessageService);
  receptionistService =
    inject(ReceptionistService, { optional: true }) ?? new ReceptionistService();
  appointmentService = inject(AppointmentService, { optional: true });
  patientService = inject(PatientService, { optional: true });
  billingService =
    inject(BillingService, { optional: true }) ?? new BillingService();
  userService = inject(UserService, { optional: true });

  viewMode = signal<'Week' | 'Day'>('Day');
  isLoading = this.receptionistService.loading;

  // Real Backend State Signals
  stats = this.receptionistService.stats;
  todaySessionsSignal = this.receptionistService.todaySessions;
  allPatients = computed<Patient[]>(() => this.patientService?.patients() ?? []);

  // Derive doctors list from API Users (Role: Doctor / Senior) + active session doctors
  allDoctors = computed<ScheduleDoctorOption[]>(() => {
    const map = new Map<string, ScheduleDoctorOption>();

    const users = this.userService?.users() ?? [];
    users
      .filter((u) =>
        u.roles?.some(
          (r) =>
            r.toLowerCase() === 'doctor' ||
            r.toLowerCase() === 'senior' ||
            r.toLowerCase() === 'therapist'
        )
      )
      .forEach((u) => {
        if (u.id) {
          map.set(String(u.id), {
            id: String(u.id),
            name: u.fullName || u.userName,
            gender: u.gender
          });
        }
      });

    this.todaySessionsSignal().forEach((s) => {
      const id = s.doctorId != null ? String(s.doctorId) : '';
      const name = s.doctorName || (id ? `Doctor #${id}` : '');
      if (id && !map.has(id)) {
        map.set(id, { id, name });
      }
    });

    return Array.from(map.values());
  });

  // Derive rooms list from API TodaySessions & Appointments
  allRooms = computed<ScheduleRoomOption[]>(() => {
    const map = new Map<string, ScheduleRoomOption>();

    this.todaySessionsSignal().forEach((s) => {
      const id = s.roomId != null ? String(s.roomId) : '';
      const displayName = s.roomName || (id ? `Room ${id}` : '');
      if (id && !map.has(id)) {
        map.set(id, { id, displayName });
      }
    });

    (this.appointmentService?.appointments() ?? []).forEach((a) => {
      const id = a.roomId != null ? String(a.roomId) : '';
      const displayName = a.roomName || (id ? `Room ${id}` : '');
      if (id && !map.has(id)) {
        map.set(id, { id, displayName });
      }
    });

    return Array.from(map.values());
  });

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
    this.receptionistService.getDashboardStats();
    this.receptionistService.getTodaySessions();
    this.patientService?.getPatients().subscribe();
    this.billingService.getInvoices();
    this.userService?.getAllUsers();
  }

  onSearchOrFilterChange() {
    const docId = this.selectedDoctorFilter;
    const roomId = this.selectedRoomFilter;
    const search = this.searchQuery.trim();

    this.receptionistService.getTodaySessions({
      search: search || undefined,
      doctorId: docId !== '' ? docId : undefined,
      roomId: roomId !== '' ? roomId : undefined
    });
  }

  // Base clinic timeline slots
  baseTimeSlots = [
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

  formatTime(isoString?: string): string {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  }

  formatHourBucket(isoString?: string): string {
    if (!isoString) return '08:00 AM';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '08:00 AM';
      d.setMinutes(0, 0, 0);
      return d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '08:00 AM';
    }
  }

  /**
   * Returns today's sessions strictly from ReceptionistService API.
   */
  get todaySessions(): TodaySession[] {
    return this.todaySessionsSignal();
  }

  // Summary KPI getters bound to API data (ReceptionistService stats & todaySessions)
  get totalTodayCount(): number {
    return this.todaySessions.length || (this.stats()?.todaysSessions ?? 0);
  }

  get upcomingCount(): number {
    return this.todaySessions.filter((s) => {
      const st = this.receptionistService.mapStatusToString(s.status);
      return st === 'Pending' || st === 'Confirmed';
    }).length;
  }

  get inProgressCount(): number {
    return this.todaySessions.filter((s) => {
      const st = this.receptionistService.mapStatusToString(s.status);
      return st === 'In Progress' || st === 'Waiting';
    }).length;
  }

  get completedCount(): number {
    const listCompleted = this.todaySessions.filter(
      (s) => this.receptionistService.mapStatusToString(s.status) === 'Completed'
    ).length;
    return listCompleted || (this.stats()?.completedSessions ?? 0);
  }

  /**
   * Schedule Filter:
   * Filters today's sessions from ReceptionistService based on selectedFilter, searchQuery, doctor, and room.
   */
  get filteredSchedule(): { time: string; sessions: TodaySession[] }[] {
    let filtered = [...this.todaySessions];

    if (this.selectedFilter === 'Upcoming') {
      filtered = filtered.filter((s) => {
        const st = this.receptionistService.mapStatusToString(s.status);
        return st === 'Pending' || st === 'Confirmed';
      });
    } else if (this.selectedFilter === 'In Progress') {
      filtered = filtered.filter((s) => {
        const st = this.receptionistService.mapStatusToString(s.status);
        return st === 'In Progress' || st === 'Waiting';
      });
    } else if (this.selectedFilter === 'Completed') {
      filtered = filtered.filter(
        (s) => this.receptionistService.mapStatusToString(s.status) === 'Completed'
      );
    }

    if (this.selectedDoctorFilter) {
      filtered = filtered.filter(
        (s) =>
          String(s.doctorId ?? '') === String(this.selectedDoctorFilter) ||
          (s.doctorName ?? '').toLowerCase() ===
            this.selectedDoctorFilter.toLowerCase()
      );
    }

    if (this.selectedRoomFilter) {
      filtered = filtered.filter(
        (s) =>
          String(s.roomId ?? '') === String(this.selectedRoomFilter) ||
          (s.roomName ?? '').toLowerCase() ===
            this.selectedRoomFilter.toLowerCase()
      );
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      filtered = filtered.filter((s) => {
        const pName = this.getPatientName(s).toLowerCase();
        const dName = this.getDoctorName(s).toLowerCase();
        const rName = this.getRoomName(s).toLowerCase();
        return pName.includes(q) || dName.includes(q) || rName.includes(q);
      });
    }

    const slotList = [...this.baseTimeSlots];
    filtered.forEach((session) => {
      const bucket = this.formatHourBucket(session.startTime);
      if (bucket && !slotList.includes(bucket)) {
        slotList.push(bucket);
      }
    });

    const grid: { time: string; sessions: TodaySession[] }[] = slotList.map((t) => ({
      time: t,
      sessions: []
    }));

    filtered.forEach((session) => {
      if (!session.startTime) {
        grid[0]?.sessions.push(session);
        return;
      }
      const exactSlot = grid.find(
        (g) => g.time === this.formatTime(session.startTime)
      );
      const bucketSlot =
        exactSlot ||
        grid.find((g) => g.time === this.formatHourBucket(session.startTime));
      if (bucketSlot) {
        bucketSlot.sessions.push(session);
      }
    });

    return grid;
  }

  resetFilters() {
    this.searchQuery = '';
    this.selectedDoctorFilter = '';
    this.selectedRoomFilter = '';
    this.selectedFilter = 'All';
    this.receptionistService.getTodaySessions();
  }

  // API-backed display resolvers (zero mock data)
  getPatientName(session: TodaySession): string {
    if (session.patientName) return session.patientName;
    const p = this.allPatients().find(
      (pt) => String(pt.id) === String(session.patientId)
    );
    return p?.nameEn || p?.nameAr || `Patient #${session.patientId}`;
  }

  getDoctorName(session: TodaySession): string {
    if (session.doctorName) return session.doctorName;
    if (session.doctorId != null) {
      const doc = this.allDoctors().find(
        (d) => String(d.id) === String(session.doctorId)
      );
      if (doc) return doc.name;
      return `Doctor #${session.doctorId}`;
    }
    return 'Unassigned';
  }

  getRoomName(session: TodaySession): string {
    if (session.roomName) return session.roomName;
    if (session.roomId != null) {
      const room = this.allRooms().find(
        (r) => String(r.id) === String(session.roomId)
      );
      if (room) return room.displayName;
      return `Room ${session.roomId}`;
    }
    return 'Unassigned';
  }

  getPatientInitials(session: TodaySession): string {
    const name = this.getPatientName(session);
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }

  getSessionBadge(session: TodaySession): string {
    if (session.packageAlert) return session.packageAlert;
    if (session.sessionNumber && session.totalSessions) {
      return `Session ${session.sessionNumber} of ${session.totalSessions}`;
    }
    const patient = this.allPatients().find(
      (p) => String(p.id) === String(session.patientId)
    );
    const total =
      patient?.treatmentPlan?.totalSessions ||
      patient?.insuranceDetails?.approvedSessions;
    if (total && session.sessionNumber) {
      return `Session ${session.sessionNumber} of ${total}`;
    }
    return '';
  }

  getMappedStatus(status: string | number | undefined): string {
    return this.receptionistService.mapStatusToString(status);
  }

  getStatusClass(status: string | number | undefined): string {
    const strStatus = this.receptionistService.mapStatusToString(status);
    switch (strStatus) {
      case 'Completed':
        return 'status-completed';
      case 'In Progress':
      case 'Waiting':
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

  /**
   * Check-in patient action with Debt Gate interceptor (using BillingService & ReceptionistService)
   */
  showDebtModal = false;
  pendingCheckInSessionId: number | null = null;
  installmentAmount: number = 0;
  installmentPaymentMethod: string = 'Cash';
  paymentMethods = ['Cash', 'Credit Card', 'E-Wallet', 'InstaPay'];
  debtAmount: number = 0;

  async checkInSession(sessionId: number | undefined) {
    if (sessionId === undefined) return;
    const session = this.todaySessions.find(
      (s) => Number(s.id) === Number(sessionId)
    );
    if (!session) return;

    const patient = this.allPatients().find(
      (p) => String(p.id) === String(session.patientId)
    );
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
      this.pendingCheckInSessionId = Number(sessionId);
      this.installmentAmount = totalOutstandingDebt;
      this.installmentPaymentMethod = 'Cash';
      this.showDebtModal = true;
      return;
    }

    await this.executeCheckIn(Number(sessionId));
  }

  async executeCheckIn(sessionId: number) {
    try {
      const inProgressStatus =
        this.receptionistService.mapStatusToNumber('In Progress');
      await firstValueFrom(
        this.receptionistService.updateSessionStatus(
          sessionId,
          inProgressStatus
        )
      );
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

    const session = this.todaySessions.find(
      (s) => Number(s.id) === Number(sessionId)
    );
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
   * if the invoice status is not 'Paid' or 'Waived', then updates status via ReceptionistService.
   */
  async checkoutSession(sessionId: number | undefined) {
    if (sessionId === undefined) return;
    try {
      const sessionInvoice = this.billingService.getInvoiceBySessionId(sessionId);
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
          Number(sessionId),
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
        detail: error.message || 'Failed to check out'
      });
    }
  }

  /**
   * Mark Absent / Cancel Session via ReceptionistService.cancelSession()
   */
  markPatientAbsent(sessionId: number | undefined) {
    if (sessionId === undefined) return;
    this.receptionistService.cancelSession(Number(sessionId)).subscribe({
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
          detail: error?.message || 'Failed to mark patient absent.'
        });
      }
    });
  }
}
