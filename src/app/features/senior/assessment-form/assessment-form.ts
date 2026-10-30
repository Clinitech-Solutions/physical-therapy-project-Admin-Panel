import { Component, inject, computed, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { firstValueFrom } from 'rxjs';
import { BookingService } from '../../../core/services/booking.service';
import { PatientService } from '../../../core/services/patient.service';
import { BookingClinician } from '../../../core/models/booking.model';
import { apiError, numericId } from '../../../core/services/reception-api';
import { ReceptionistLocale } from '../../../shared/receptionist-locale';

@Component({
  selector: 'app-assessment-form', standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './assessment-form.html', styleUrl: './assessment-form.css',
})
export class AssessmentForm implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private booking = inject(BookingService);
  private patients = inject(PatientService);
  private messages = inject(MessageService);
  readonly locale = new ReceptionistLocale();
  patientId = signal(''); sessionId = signal('');
  readonly loading = signal(false); readonly saving = signal(false); readonly error = signal('');
  readonly eligibleDoctors = signal<BookingClinician[]>([]);
  private generation = 0;
  form = this.fb.group({ diagnosis: ['', Validators.required], totalSessions: [1, [Validators.required, Validators.min(1), Validators.max(200)]],
    frequency: ['', Validators.required], assignedDoctorId: ['', Validators.required], exercises: [''] });
  patient = computed(() => this.patients.patients().find(p => p.id === this.patientId()));
  smartDoctors = computed(() => this.eligibleDoctors().map(d => ({ ...d, isGenderMatch: true, isRecommended: d.preferred || d.currentLoad === 0 })));
  patientAge = computed(() => {
    const birth = this.patient()?.birthDate; if (!birth) return '-';
    const date = new Date(birth), now = new Date(); if (!Number.isFinite(date.getTime())) return '-';
    return String(now.getFullYear() - date.getFullYear() - (now.getMonth() < date.getMonth() || now.getMonth() === date.getMonth() && now.getDate() < date.getDate() ? 1 : 0));
  });
  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.patientId.set(params['patientId'] || ''); this.sessionId.set(params['sessionId'] || '');
      void this.load();
    });
  }
  private async load() {
    const generation = ++this.generation; this.loading.set(true); this.error.set('');
    try {
      const id = numericId(this.patientId()); numericId(this.sessionId());
      const [, clinicians] = await Promise.all([firstValueFrom(this.patients.getPatientById(id)), firstValueFrom(this.booking.clinicians(id, null, true))]);
      if (generation === this.generation) this.eligibleDoctors.set(clinicians);
    } catch (error) { if (generation === this.generation) this.error.set(apiError(error)); }
    finally { if (generation === this.generation) this.loading.set(false); }
  }
  async submit() {
    if (this.form.invalid || this.saving() || this.loading()) { this.form.markAllAsTouched(); return; }
    this.saving.set(true); this.error.set('');
    try {
      const value = this.form.getRawValue();
      const frequency = ({ 'Daily': 7, 'Twice a week': 2, 'Three times a week': 3, 'Once a week': 1 } as Record<string, number>)[value.frequency ?? ''];
      await firstValueFrom(this.booking.completeAssessment({ appointmentId: numericId(this.sessionId()), diagnosis: value.diagnosis ?? '',
        numberOfSessions: Number(value.totalSessions), frequencyPerWeek: frequency, doctorId: value.assignedDoctorId ?? '',
        treatmentType: 'PhysicalTherapy', exercises: value.exercises || null }));
      this.messages.add({ severity: 'success', summary: this.locale.text('SUCCESS', 'Success'), detail: this.locale.text('ASSESSMENT_SAVED', 'Assessment completed and treatment plan saved.') });
      await this.router.navigate(['/senior/dashboard']);
    } catch (error) { this.error.set(apiError(error)); }
    finally { this.saving.set(false); }
  }
  selectDoctorFromList(id: string) { this.form.patchValue({ assignedDoctorId: id }); }
}
