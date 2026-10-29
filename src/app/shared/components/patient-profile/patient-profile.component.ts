import { ClinicalRecordsService } from '../../../core/services/clinical-records.service';
import { InsuranceDocumentService } from '../../../core/services/insurance-document.service';
import { ReceptionContracts } from '../../../core/services/reception-contracts';
import { apiError, numericId, ReceptionError } from '../../../core/services/reception-api';
import { firstValueFrom } from 'rxjs';
import { ReceptionistLocale, ReceptionistTextPipe } from '../../receptionist-locale';
import { Component, EventEmitter, Input, Output, inject, OnChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { ProgressBar } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { BillingService } from '../../../core/services/billing.service';
import { PatientService } from '../../../core/services/patient.service';
import { AppointmentService } from '../../../core/services/appointment.service';
import { Patient } from '../../../core/models/patient.model';
import { Session, SessionStatus } from '../../../core/models/session.model';

@Component({
  selector: 'app-patient-profile',
  standalone: true,
  imports: [ReceptionistTextPipe,
    CommonModule,
    FormsModule,
    TranslateModule,
    DialogModule,
    TableModule,
    ProgressBar,
    TagModule,
    ButtonModule,
    TooltipModule
  ],
  templateUrl: './patient-profile.component.html',
  styleUrls: ['./patient-profile.component.css']
})
export class PatientProfileComponent implements OnChanges {
  readonly locale = new ReceptionistLocale();
  readonly clinical = inject(ClinicalRecordsService);
  readonly documentService = inject(InsuranceDocumentService);
  readonly contracts = inject(ReceptionContracts);
  readonly profileError = signal('');
  readonly patientLoading = signal(false);
  readonly documentsLoading = signal(false);
  readonly documentsError = signal('');
  readonly uploadError = signal('');
  readonly uploadSaved = signal(false);
  private generation = 0;
  private loadedPatientId: string | null = null;
  files: File[] = [];
  public billingService = inject(BillingService, { optional: true }) ?? new BillingService();
  public patientService = inject(PatientService);
  public appointmentService = inject(AppointmentService, { optional: true });

  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();

  @Input() patientId: string | null = null;
  @Input() patient: Patient | null = null;

  ngOnChanges() { if (this.visible) this.refreshProfile(); }
  refreshProfile() {
    const id = this.patientId ?? this.patient?.id;
    if (!id) return;
    if (id !== this.loadedPatientId) { this.files=[];this.uploadError.set('');this.uploadSaved.set(false);this.loadedPatientId=id; }
    const generation = ++this.generation;
    this.profileError.set(''); this.patientLoading.set(true);
    this.documentsError.set(''); this.documentsLoading.set(false);
    let patientId: number;
    try { patientId = numericId(id); }
    catch (error) { this.profileError.set(apiError(error)); this.patientLoading.set(false); return; }
    this.patientService.getPatientById(patientId).subscribe({
      next: patient => {
        if (generation !== this.generation) return;
        this.patientLoading.set(false);
        if (patient.paymentType === 'Insurance') this.loadDocuments(patientId);
        else { this.files = []; this.uploadError.set(''); this.uploadSaved.set(false); }
      },
      error: error => { if(generation===this.generation){this.profileError.set(apiError(error));this.patientLoading.set(false);} }
    });
    this.clinical.load(patientId);
    this.appointmentService?.getAppointments();
    this.billingService.getInvoices();
  }
  private loadDocuments(patientId: number) {
    const generation = this.generation;
    this.documentsLoading.set(true); this.documentsError.set('');
    this.documentService.getDocumentsForPatient(patientId).subscribe({
      next: () => { if(generation===this.generation)this.documentsLoading.set(false); },
      error: error => { if(generation===this.generation){this.documentsError.set(error instanceof ReceptionError?this.locale.text(error.key,error.message):apiError(error));this.documentsLoading.set(false);} }
    });
  }
  get currentPatient(): Patient | undefined {
    const id = this.patientId ?? this.patient?.id;
    return this.patientService.patients().find(p => p.id === id) ?? (this.patient && this.patient.id === id ? this.patient : undefined);
  }
  get isInsurancePatient(): boolean { return this.currentPatient?.paymentType === 'Insurance'; }
  get isSelfPayPatient(): boolean { return ['Cash', 'Online', 'Card', 'InstaPay'].includes(this.currentPatient?.paymentType ?? ''); }
  get plans() { const id = this.patientId ?? this.patient?.id; return id ? this.clinical.plansForPatient(Number(id)) : []; }
  get primaryDoctorName(): string { return [...new Set(this.plans.map(p => p.doctorName))].filter(Boolean).join(', ') || this.locale.label('Unknown'); }
  get totalSessions(): number { return this.plans.reduce((sum,p) => sum + Number(p.numberOfSessions),0); }
  get completedSessionsCount(): number { return this.plans.reduce((sum,p) => sum + Number(p.completedSessions),0); }
  get progressPercentage(): number { return this.totalSessions > 0 ? this.completedSessionsCount / this.totalSessions * 100 : 0; }
  get sessions() {
    const plans = new Map(this.plans.map(p => [Number(p.id),p]));
    return this.clinical.sessions().filter(s => plans.has(Number(s.treatmentPlanId))).map(s => ({
      id: String(s.id), sessionNumber: s.sessionNumber, doctorId: plans.get(Number(s.treatmentPlanId))!.doctorId,
      scheduledAt: s.sessionDate ?? undefined, checkInTime: s.checkIn ?? undefined, checkOutTime: s.checkOut ?? undefined,
      status: this.contracts.label('sessionStatus',s.status), type: 'Session'
    })).sort((a,b) => a.sessionNumber - b.sessionNumber);
  }
  get patientAppointments() { const id = this.currentPatient?.id; return (this.appointmentService?.appointments() ?? []).filter(a => String(a.patientId) === id); }
  get patientInvoices() { const id = this.currentPatient?.id; return this.billingService.invoices().filter(i => String(i.patientId) === id); }
  get patientAssessments() { const id=this.currentPatient?.id;return this.clinical.assessments().filter(a=>String(a.patientId)===id); }
  getDoctorDisplayName(doctorId?: string): string { return this.plans.find(p => p.doctorId === doctorId)?.doctorName || this.locale.label('Unknown'); }
  getPaymentInfo(sessionId: string): {label: string; severity: 'success'|'info'|'warn'|'danger'|'secondary'} {
    const appointment = this.patientAppointments.find(a => String(a.treatmentPlanSessionId) === sessionId);
    const invoice = appointment ? this.patientInvoices.find(i => i.appointmentId === appointment.id) : undefined;
    return {label: invoice ? this.locale.label(this.billingService.mapStatusToString(invoice.status)) : this.locale.label('Unknown'), severity:'secondary'};
  }
  onFilesSelected(event: Event) { this.files = Array.from((event.target as HTMLInputElement).files ?? []); this.uploadSaved.set(false); }
  async uploadDocuments() {
    if(!this.isInsurancePatient||this.documentService.mutation.busy()||!this.files.length||!this.currentPatient)return;
    this.uploadError.set(''); this.uploadSaved.set(false);
    const id = numericId(this.currentPatient.id);
    const generation = this.generation;
    try { await firstValueFrom(this.documentService.uploadDocuments(id,this.files)); }
    catch(error) { if(generation===this.generation)this.uploadError.set(apiError(error)); return; }
    if(generation!==this.generation)return;
    this.files=[]; this.uploadSaved.set(true); this.loadDocuments(id);
  }

  getSessionStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case 'Completed':
        return 'success';
      case 'In Progress':
        return 'info';
      case 'Confirmed':
        return 'success';
      case 'Waiting':
        return 'info';
      case 'Pending':
        return 'warn';
      case 'Cancelled':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  formatTime(isoString?: string): string | null {
    if (!isoString) return null;
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return null;
      return date.toLocaleTimeString(this.locale.language, { hour: '2-digit', minute: '2-digit' });
    } catch {
      return null;
    }
  }

  formatDate(isoString?: string): string | null {
    if (!isoString) return null;
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return null;
      return date.toLocaleDateString(this.locale.language, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return null;
    }
  }

  onVisibleChange(val: boolean) {
    this.visible = val;
    this.visibleChange.emit(val);
  }

  closeModal() {
    this.generation++; this.visible = false;
    this.files = []; this.uploadSaved.set(false);
    this.visibleChange.emit(false);
  }
}
