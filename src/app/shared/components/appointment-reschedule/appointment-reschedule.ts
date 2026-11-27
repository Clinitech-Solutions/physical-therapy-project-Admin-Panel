import { Component, Input, Output, EventEmitter, inject, signal, OnChanges, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { firstValueFrom, Subscription } from 'rxjs';
import { AuthService } from '../../../core/services/auth';
import { PatientProfileService } from '../../../core/services/patient-profile.service';
import { RescheduleAvailability, RescheduleRequest, RescheduleSlot } from '../../../core/models/patient-profile.model';
import { apiError, clinicDay, ReceptionEvents, unknownOutcome } from '../../../core/services/reception-api';
import { ReceptionistLocale, ReceptionistTextPipe } from '../../receptionist-locale';
import { ActionButtonDirective } from '../../action-ui/action-button';

export interface RescheduleTarget {
  id?: number;
  patientId: number;
  patientName?: string;
  status: string | number;
  startTime: string;
  actualCheckIn?: string | null;
  actualCheckOut?: string | null;
  treatmentStartedAt?: string | null;
  treatmentEndedAt?: string | null;
}
export function rescheduleEligible(a: RescheduleTarget): boolean {
  return [0, 'Pending'].includes(a.status) && Date.parse(a.startTime) > Date.now() &&
    !a.actualCheckIn && !a.actualCheckOut && !a.treatmentStartedAt && !a.treatmentEndedAt;
}

/** The same audited single-appointment API used by Patient Profile, including lost-response reconciliation. */
@Component({
  selector: 'app-appointment-reschedule', standalone: true,
  imports: [FormsModule, DialogModule, ActionButtonDirective, ReceptionistTextPipe],
  templateUrl: './appointment-reschedule.html', styleUrl: './appointment-reschedule.css',
})
export class AppointmentReschedule implements OnChanges, OnDestroy {
  readonly locale = new ReceptionistLocale();
  private readonly api = inject(PatientProfileService);
  private readonly auth = inject(AuthService);
  private readonly events = inject(ReceptionEvents);
  @Input() target: RescheduleTarget | null = null;
  @Output() targetChange = new EventEmitter<RescheduleTarget | null>();
  @Output() saved = new EventEmitter<void>();
  readonly availability = signal<RescheduleAvailability | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly pending = signal<RescheduleRequest | null>(null);
  readonly missing = signal(false);
  date = '';
  clinicianId = '';
  clinicians: { id: string; name: string; role: string }[] = [];
  selected: RescheduleSlot | null = null;
  reason = '';
  private read?: Subscription;
  private generation = 0;
  readonly today = clinicDay(new Date());
  get visible() { return !!this.target; }
  set visible(value: boolean) { if (!value) this.close(); }
  get changed() {
    const a = this.availability(), s = this.selected;
    return !!a && !!s && (s.startTime !== a.currentStart || s.roomId !== a.currentRoomId || this.clinicianId !== a.currentClinicianId);
  }
  get allowed() { return ['Receptionist', 'Ceo', 'Admin', 'Owner'].some(r => this.auth.hasRole(r as never)); }
  private get storageKey() { return `ptcenter.schedule-reschedule.${this.auth.currentUser()?.id}.${this.target?.id}`; }
  ngOnChanges() {
    this.read?.unsubscribe(); this.generation++;
    this.availability.set(null); this.pending.set(null); this.missing.set(false); this.error.set('');
    this.selected = null; this.clinicianId = ''; this.clinicians = []; this.reason = '';
    if (!this.target || !this.allowed) return;
    this.date = clinicDay(new Date(this.target.startTime));
    try {
      const raw = sessionStorage.getItem(this.storageKey);
      if (raw) {
        const p = JSON.parse(raw) as RescheduleRequest;
        if (p.operationKey && p.expectedVersion && p.startTime && p.roomId && p.reason) {
          this.pending.set(p); this.reason = p.reason; this.date = clinicDay(new Date(p.startTime)); this.clinicianId = p.clinicianId ?? '';
        }
      }
    } catch {}
    this.load();
    setTimeout(() => document.getElementById('schedule-reschedule-date')?.focus());
  }
  ngOnDestroy() { this.read?.unsubscribe(); this.generation++; }
  load() {
    this.read?.unsubscribe(); const generation = ++this.generation;
    this.selected = null; this.availability.set(null); this.error.set(''); this.loading.set(false);
    if (!this.target?.id || !/^\d{4}-\d{2}-\d{2}$/.test(this.date)) return;
    this.loading.set(true);
    this.read = this.api.slots(this.target.id, this.date, this.clinicianId || undefined).subscribe({
      next: a => {
        if (generation !== this.generation || a.appointmentId !== this.target?.id) return;
        this.availability.set(a); this.clinicians = a.clinicians ?? [];
        this.clinicianId = a.clinicianId; this.loading.set(false);
      },
      error: e => { if (generation === this.generation) { this.error.set(apiError(e)); this.loading.set(false); } },
    });
  }
  private remember(request: RescheduleRequest | null) {
    this.pending.set(request);
    try { if (request) sessionStorage.setItem(this.storageKey, JSON.stringify(request)); else sessionStorage.removeItem(this.storageKey); } catch {}
  }
  async save() {
    if (!this.allowed || this.saving() || this.pending() || this.loading() || !this.changed || !this.reason.trim() || !this.selected || !this.availability()) return;
    const request: RescheduleRequest = {
      operationKey: crypto.randomUUID(), expectedVersion: this.availability()!.version,
      startTime: this.selected.startTime, roomId: this.selected.roomId, clinicianId: this.clinicianId, reason: this.reason.trim(),
    };
    this.remember(request); await this.send(request);
  }
  private async send(request: RescheduleRequest) {
    if (!this.target?.id) return;
    this.saving.set(true); this.error.set(''); this.missing.set(false);
    try { await firstValueFrom(this.api.save(this.target.id, request)); this.accept(); }
    catch (e) {
      this.error.set(apiError(e));
      if (!unknownOutcome(e)) {
        this.remember(null);
        if ((e as {status?: number}).status === 409) {
          const message = this.error(); this.load(); this.error.set(message);
        }
      }
    } finally { this.saving.set(false); }
  }
  async reconcile() {
    if (!this.target?.id || !this.pending() || this.saving()) return;
    this.saving.set(true); this.error.set('');
    try { await firstValueFrom(this.api.reconcile(this.target.id, this.pending()!.operationKey)); this.accept(); }
    catch (e) { this.error.set(apiError(e)); this.missing.set((e as {status?: number}).status === 404); }
    finally { this.saving.set(false); }
  }
  async retryOriginal() { if (this.pending() && this.missing() && !this.saving()) await this.send(this.pending()!); }
  private accept() {
    this.remember(null); this.events.changed.next('appointments'); this.saved.emit();
    this.targetChange.emit(null);
  }
  close() {
    if (this.saving() || this.pending()) return;
    this.read?.unsubscribe(); this.generation++; this.targetChange.emit(null);
  }
}
