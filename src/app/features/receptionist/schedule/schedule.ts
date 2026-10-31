import { RoomService } from '../../../core/services/room.service';
import { ClinicianService } from '../../../core/services/clinician.service';
import { AppointmentWorkflowService } from '../../../core/services/appointment-workflow.service';
import { apiError, ReceptionError } from '../../../core/services/reception-api';
import { ReceptionistLocale, ReceptionistTextPipe } from '../../../shared/receptionist-locale';
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
import { AppointmentService, Appointment } from '../../../core/services/appointment.service';
import { PatientService } from '../../../core/services/patient.service';
import { BillingService } from '../../../core/services/billing.service';

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
  imports: [ReceptionistTextPipe,
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
  styleUrls: ['./schedule.css', './schedule-timeline.css', './schedule-session-cards.css']
})
export class ScheduleComponent implements OnInit {
  readonly locale = new ReceptionistLocale();
  messageService = inject(MessageService);
  receptionistService =
    inject(ReceptionistService, { optional: true }) ?? new ReceptionistService();
  appointmentService = inject(AppointmentService, { optional: true });
  patientService = inject(PatientService, { optional: true });
  billingService =
    inject(BillingService, { optional: true }) ?? new BillingService();

  readonly roomService = inject(RoomService);
  readonly clinicianService = inject(ClinicianService);
  readonly workflow = inject(AppointmentWorkflowService);
  readonly actionError = signal('');
  readonly editingAppointment = signal<Appointment | null>(null);
  readonly editingLoading = signal(false);
  editStart = '';
  get editEnd(): string {
    const start = new Date(this.editStart);
    return Number.isFinite(start.getTime()) ? new Date(start.getTime() + 3600000).toISOString() : '';
  }
  editClinicianId = '';
  editRoomId: number | null = null;
  get editVisible() { return this.editingAppointment() !== null; }
  set editVisible(value: boolean) { if (!value && !this.appointmentService?.mutation.busy()) this.editingAppointment.set(null); }
  async openEditAppointment(session: TodaySession) {
    if (!this.appointmentService || this.editingLoading()) return;
    this.editingLoading.set(true); this.actionError.set('');
    try {
      const appointment = await firstValueFrom(this.appointmentService.getAppointment(session.id));
      if (typeof appointment.status !== 'number' || !Number.isInteger(appointment.status)) {
        throw new ReceptionError('ENUM_DEFINITION_PENDING', 'This operation needs a confirmed backend status definition.');
      }
      const local = (value: string) => {
        const date = new Date(value);
        return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}T${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
      };
      this.editStart = local(appointment.startTime);
      this.editClinicianId = appointment.doctorId ?? appointment.seniorId ?? '';
      this.editRoomId = appointment.roomId ?? null; this.editingAppointment.set(appointment);
    } catch (error) { this.actionError.set(error instanceof ReceptionError ? this.locale.text(error.key,error.message) : apiError(error)); }
    this.editingLoading.set(false);
  }
  async saveAppointmentEdit() {
    const appointment = this.editingAppointment();
    if (!appointment || !this.appointmentService || this.appointmentService.mutation.busy()) return;
    this.actionError.set('');
    try {
      const clinician = this.allDoctors().find(d => d.id === this.editClinicianId);
      const unchanged = this.editClinicianId === (appointment.doctorId ?? appointment.seniorId);
      if (!unchanged && !clinician) throw new ReceptionError('CLINICIAN_REQUIRED', 'Select a clinician from the server directory.');
      await firstValueFrom(this.appointmentService.updateAppointment(appointment.id!, {
        doctorId: unchanged ? appointment.doctorId ?? null : clinician!.roles.includes('Doctor') ? clinician!.id : null,
        seniorId: unchanged ? appointment.seniorId ?? null : clinician!.roles.includes('Doctor') ? null : clinician!.id,
        roomId: this.editRoomId, appointmentType: appointment.appointmentType,
        startTime: new Date(this.editStart), endTime: new Date(this.editEnd), status: appointment.status as number
      }));
    } catch (error) { this.actionError.set(error instanceof ReceptionError ? this.locale.text(error.key,error.message) : apiError(error)); return; }
    this.editingAppointment.set(null);
    this.messageService.add({severity:'success',summary:this.locale.text('SUCCESS','Success'),detail:this.locale.text('APPOINTMENT_OPERATION_SAVED','Appointment change saved. Refreshing the schedule separately.')});
    this.onSearchOrFilterChange();
  }

  viewMode = signal<'Week' | 'Day'>('Day');
  isLoading = this.receptionistService.loading;

  // Real Backend State Signals
  stats = this.receptionistService.stats;
  todaySessionsSignal = this.receptionistService.todaySessions;
  allPatients = computed<Patient[]>(() => this.patientService?.patients() ?? []);

  allDoctors = this.clinicianService.clinicians;
  allRooms = computed(() => this.roomService.rooms().map(r => ({id:String(r.id),displayName:r.name})));

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

  readonly patientLookupError = signal('');
  refreshPatientLookup() {
    this.patientLookupError.set('');
    this.patientService?.getPatients().subscribe({error:e=>this.patientLookupError.set(apiError(e))});
  }

  ngOnInit() {
    this.receptionistService.getDashboardStats();
    this.receptionistService.getTodaySessions();
    this.refreshPatientLookup();
    this.clinicianService.load();
    this.roomService.load();
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
      return d.toLocaleTimeString(this.locale.language, {
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
    return this.todaySessions.length;
  }

  get upcomingCount(): number | null {
    if(this.todaySessions.some(s => this.getMappedStatus(s.status) === 'Unknown'))return null;
    return this.todaySessions.filter((s) => {
      const st = this.receptionistService.mapStatusToString(s.status);
      return st === 'Pending' || st === 'Confirmed';
    }).length;
  }

  get inProgressCount(): number | null {
    if(this.todaySessions.some(s => this.getMappedStatus(s.status) === 'Unknown'))return null;
    return this.todaySessions.filter((s) => {
      const st = this.receptionistService.mapStatusToString(s.status);
      return st === 'In Progress' || st === 'Waiting';
    }).length;
  }

  get completedCount(): number | null {
    if(this.todaySessions.some(s => this.getMappedStatus(s.status) === 'Unknown'))return null;
    const listCompleted = this.todaySessions.filter(
      (s) => this.receptionistService.mapStatusToString(s.status) === 'Completed'
    ).length;
    return listCompleted;
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
    const p = this.allPatients().find(
      (pt) => String(pt.id) === String(session.patientId)
    );
    return this.locale.patientName(p) || session.patientName || this.locale.text('PATIENT_NUMBER', "Patient #{{id}}", { id: session.patientId });
  }

  getDoctorName(session: TodaySession): string {
    if (session.doctorName) return session.doctorName;
    if (session.doctorId != null) {
      const doc = this.allDoctors().find(
        (d) => String(d.id) === String(session.doctorId)
      );
      if (doc) return doc.name;
      return this.locale.text('DOCTOR_NUMBER', "Doctor #{{id}}", { id: session.doctorId });
    }
    return this.locale.label('Unassigned');
  }

  getRoomName(session: TodaySession): string {
    if (session.roomName) return session.roomName;
    if (session.roomId != null) {
      const room = this.allRooms().find(
        (r) => String(r.id) === String(session.roomId)
      );
      if (room) return room.displayName;
      return this.locale.text('ROOM_NUMBER', "Room {{id}}", { id: session.roomId });
    }
    return this.locale.label('Unassigned');
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
      return this.locale.text('SESSION_PROGRESS', "Session {{number}} of {{total}}", { number: session.sessionNumber, total: session.totalSessions });
    }
    const patient = this.allPatients().find(
      (p) => String(p.id) === String(session.patientId)
    );
    const total =
      patient?.treatmentPlan?.totalSessions ||
      patient?.insuranceDetails?.approvedSessions;
    if (total && session.sessionNumber) {
      return this.locale.text('SESSION_PROGRESS', "Session {{number}} of {{total}}", { number: session.sessionNumber, total });
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
        return 'status-unknown';
    }
  }

  showDebtModal = false;
  pendingCheckInSessionId: number | null = null;
  installmentAmount = 0;
  installmentPaymentMethod = '';
  paymentMethods: string[] = [];
  debtAmount = 0;
  async checkInSession(id: number | undefined) { if (id !== undefined) await this.executeCheckIn(id); }
  async executeCheckIn(id: number) { await this.perform(() => this.workflow.transition(id,'In Progress')); }
  async checkoutSession(id: number | undefined) { if (id !== undefined) await this.perform(() => this.workflow.transition(id,'Completed')); }
  async checkOutPatient(id: number) { await this.checkoutSession(id); }
  async confirmCheckIn(withInstallment: boolean) {
    if (withInstallment) { this.actionError.set(this.locale.text('INSTALLMENT_SUPPORT_PENDING','Installment plans are not available. Collect against a saved invoice in Billing.')); return; }
    if(this.pendingCheckInSessionId !== null) await this.executeCheckIn(this.pendingCheckInSessionId);
    this.showDebtModal = false;
  }
  async markPatientAbsent(id: number | undefined) { if(id!==undefined) await this.perform(() => this.workflow.cancel(id)); }
  private async perform(request: () => import('rxjs').Observable<unknown>) {
    if(this.workflow.mutation.busy())return;
    this.actionError.set('');
    try { await firstValueFrom(request()); }
    catch(error) { this.actionError.set(error instanceof ReceptionError ? this.locale.text(error.key,error.message) : apiError(error)); return; }
    this.messageService.add({severity:'success',summary:this.locale.text('SUCCESS','Success'),detail:this.locale.text('APPOINTMENT_OPERATION_SAVED','Appointment change saved. Refreshing the schedule separately.')});
    this.onSearchOrFilterChange(); this.receptionistService.getDashboardStats();
  }
}
