import { RoomService } from '../../../core/services/room.service';
import { ClinicianService } from '../../../core/services/clinician.service';
import { AppointmentWorkflowService } from '../../../core/services/appointment-workflow.service';
import { apiError, ReceptionError } from '../../../core/services/reception-api';
import { ReceptionistLocale } from '../../../shared/receptionist-locale';
import { Component, inject, signal, computed, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { LanguageService } from "../../../core/services/language";
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

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
  readonly locale = new ReceptionistLocale();
  langService = inject(LanguageService);
  receptionistService = inject(ReceptionistService, { optional: true }) ?? new ReceptionistService();
  readonly roomService = inject(RoomService);
  readonly clinicianService = inject(ClinicianService);
  readonly workflow = inject(AppointmentWorkflowService);
  readonly actionError = signal('');
  patientService = inject(PatientService, { optional: true });
  billingService = inject(BillingService, { optional: true }) ?? new BillingService();
  messageService = inject(MessageService);

  todayDate = new Date();

  // Bound strictly to ReceptionistService signals
  stats = this.receptionistService.stats;
  todaySessions = this.receptionistService.todaySessions;
  loading = this.receptionistService.loading;

  allPatients = computed(() => this.patientService?.patients() ?? []);
  allDoctors = this.clinicianService.clinicians;
  allRooms = computed(() => this.roomService.rooms().map(r => ({id:String(r.id),displayName:r.name})));

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

  readonly patientLookupError = signal('');
  refreshPatientLookup() {
    this.patientLookupError.set('');
    this.patientService?.getPatients().subscribe({error:e=>this.patientLookupError.set(apiError(e))});
  }

  ngOnInit(): void {
    this.receptionistService.getDashboardStats();
    this.receptionistService.getTodaySessions();
    this.refreshPatientLookup();
    this.roomService.load();this.clinicianService.load();
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
      doctorId: docId || undefined,
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
        this.getDoctorName(session.doctorId)
      ).toLowerCase();
      const roomName = (
        session.roomName ||
        this.getRoomName(session.roomId)
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
    const idStr = patientId != null ? patientId.toString() : '';
    const p = this.allPatients().find((pt) => pt.id === idStr);
    return this.locale.patientName(p) || fallbackName || this.locale.text('PATIENT_NUMBER','Patient #{{id}}',{id:idStr});
  }

  getPatientAvatar(patientId: string | number, patientName?: string): string {
    const idStr = patientId != null ? patientId.toString() : '';
    const p = this.allPatients().find((pt) => pt.id === idStr);
    if (p?.avatar) return p.avatar;
    const resolvedName = patientName || '';
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
      return new Date(isoString).toLocaleTimeString(this.locale.language, {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  }

  getDoctorName(id?: string|null): string { return this.allDoctors().find(d => d.id === id)?.name ?? (id ? '#'+id : this.locale.label('Unknown')); }
  getRoomName(id?: number|null): string { return this.allRooms().find(r => r.id === String(id))?.displayName ?? (id ? '#'+id : this.locale.label('Unknown')); }
  getSessionBadge(session: TodaySession): string { return ''; }
  onCheckInClick(session: TodaySession) { return this.checkIn(session.id); }
  async checkIn(id: number) { await this.perform(() => this.workflow.transition(id,'In Progress')); }
  async checkOut(id: number) { await this.perform(() => this.workflow.transition(id,'Completed')); }
  async cancelSession(id: number) { await this.perform(() => this.workflow.cancel(id)); }
  async markPatientAbsent(id: number) { await this.cancelSession(id); }
  refresh() {
    this.receptionistService.getDashboardStats();this.applySessionFilters();this.roomService.load();this.clinicianService.load();
  }
  private async perform(request: () => import('rxjs').Observable<unknown>) {
    if(this.workflow.mutation.busy())return;
    this.actionError.set('');
    try { await firstValueFrom(request()); }
    catch(error) {this.actionError.set(error instanceof ReceptionError?this.locale.text(error.key,error.message):apiError(error));return;}
    this.messageService.add({severity:'success',summary:this.locale.text('SUCCESS','Success'),detail:this.locale.text('APPOINTMENT_OPERATION_SAVED','Appointment change saved. Refreshing the schedule separately.')});
    this.receptionistService.getDashboardStats();this.applySessionFilters();
  }
}
export { Dashboard as DashboardComponent };
