import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { ProgressBar } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ClinicStateService } from '../../../core/services/state/clinic-state.service';
import { Patient } from '../../../core/models/patient.model';
import { Session, SessionStatus } from '../../../core/models/session.model';

@Component({
  selector: 'app-patient-profile',
  standalone: true,
  imports: [
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
export class PatientProfileComponent {
  public clinicState = inject(ClinicStateService);

  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();

  @Input() patientId: string | null = null;
  @Input() patient: Patient | null = null;

  get currentPatient(): Patient | undefined {
    if (this.patient) return this.patient;
    if (this.patientId) return this.clinicState.getPatientById(this.patientId);
    return undefined;
  }

  get primaryDoctorName(): string {
    const p = this.currentPatient;
    if (p?.treatmentPlan?.primaryDoctorId) {
      return this.clinicState.getDoctorName(p.treatmentPlan.primaryDoctorId);
    }
    return 'Unassigned';
  }

  get totalSessions(): number {
    const p = this.currentPatient;
    return p?.treatmentPlan?.totalSessions || p?.insuranceDetails?.approvedSessions || this.sessions.filter(s => s.type !== 'Assessment').length || 0;
  }

  get completedSessionsCount(): number {
    return this.sessions.filter(s => s.status === 'Completed' && s.type !== 'Assessment').length;
  }

  get progressPercentage(): number {
    const total = this.totalSessions;
    if (!total) return 0;
    return Math.min(100, Math.round((this.completedSessionsCount / total) * 100));
  }

  get sessions(): Session[] {
    const p = this.currentPatient;
    if (!p) return [];

    const existingSessions = this.clinicState.getSessionsByPatientId(p.id);
    const total = p.treatmentPlan?.totalSessions || p.insuranceDetails?.approvedSessions || existingSessions.length;

    if (total <= existingSessions.length) {
      return existingSessions;
    }

    const result: Session[] = [...existingSessions];
    const existingNumbers = new Set(existingSessions.map(s => s.sessionNumber).filter(Boolean));

    for (let num = 1; num <= total; num++) {
      if (!existingNumbers.has(num)) {
        result.push({
          id: `synth_${p.id}_s${num}`,
          patientId: p.id,
          doctorId: p.treatmentPlan?.primaryDoctorId || '',
          status: 'Pending',
          type: 'Session',
          sessionNumber: num
        });
      }
    }

    return result.sort((a, b) => (a.sessionNumber || 0) - (b.sessionNumber || 0));
  }

  getDoctorDisplayName(doctorId?: string): string {
    if (doctorId) {
      const docName = this.clinicState.getDoctorName(doctorId);
      if (docName && docName !== 'Unassigned') {
        return docName;
      }
    }
    return this.primaryDoctorName;
  }

  getPaymentInfo(sessionId: string): { label: string; severity: 'success' | 'info' | 'warn' | 'danger' | 'secondary' } {
    const invoice = this.clinicState.getSessionInvoice(sessionId);
    if (!invoice) {
      return { label: 'RECEPTIONIST.UNBILLED', severity: 'secondary' };
    }
    switch (invoice.status) {
      case 'Paid':
        return { label: invoice.status, severity: 'success' };
      case 'Pending':
        return { label: invoice.status, severity: 'warn' };
      case 'Partial':
        return { label: invoice.status, severity: 'info' };
      default:
        return { label: invoice.status, severity: 'secondary' };
    }
  }

  getSessionStatusSeverity(status: SessionStatus): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
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
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return null;
    }
  }

  formatDate(isoString?: string): string | null {
    if (!isoString) return null;
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return null;
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return null;
    }
  }

  onVisibleChange(val: boolean) {
    this.visible = val;
    this.visibleChange.emit(val);
  }

  closeModal() {
    this.visible = false;
    this.visibleChange.emit(false);
  }
}
