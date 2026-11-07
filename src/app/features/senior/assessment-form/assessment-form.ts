import { Component, inject, computed, OnInit, signal, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { firstValueFrom } from 'rxjs';
import { BookingService, AssessmentWorkspace } from '../../../core/services/booking.service';
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
  private translate = inject(TranslateService);
  private element: ElementRef<HTMLElement> = inject(ElementRef);
  readonly locale = new ReceptionistLocale();
  patientId = signal(''); sessionId = signal('');
  readonly loading = signal(false); readonly saving = signal(false); readonly error = signal('');
  readonly eligibleDoctors = signal<BookingClinician[]>([]);
  readonly context = signal<AssessmentWorkspace|null>(null);
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
    const generation = ++this.generation; this.loading.set(true); this.error.set(''); this.context.set(null);
    this.form.disable();
    try {
      const id = numericId(this.patientId()); numericId(this.sessionId());
      const [, clinicians, context] = await Promise.all([firstValueFrom(this.patients.getPatientById(id)), firstValueFrom(this.booking.clinicians(id, null, true)), firstValueFrom(this.booking.assessmentWorkspace(numericId(this.sessionId())))]);
      if(context.patientId!==id)throw new Error('The patient does not match this assessment appointment.');
      if (generation === this.generation) {
        this.eligibleDoctors.set(clinicians); this.context.set(context);
        this.form.reset({diagnosis:context.diagnosis,totalSessions:context.numberOfSessions,
          frequency:({1:'Once a week',2:'Twice a week',3:'Three times a week',7:'Daily'} as Record<number,string>)[context.frequencyPerWeek] ?? String(context.frequencyPerWeek),
          assignedDoctorId:context.doctorId ?? '',exercises:context.exercises ?? ''});
        context.completedAt ? this.form.disable() : this.form.enable();
      }
    } catch (error) { if (generation === this.generation) this.error.set(apiError(error)); }
    finally { if (generation === this.generation) this.loading.set(false); }
  }
  async submit() {
    if (this.saving() || this.loading() || !this.context() || this.context()?.completedAt) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set(this.locale.text('VALIDATION_REVIEW_REQUIRED','Review the highlighted fields and required selections before submitting.'));
      this.messages.add({severity:'warn',summary:this.locale.text('WARNING','Please review'),detail:this.error()});
      this.element.nativeElement.querySelector<HTMLElement>('[formcontrolname].ng-invalid')?.focus();
      return;
    }
    this.saving.set(true); this.error.set('');
    try {
      const value = this.form.getRawValue();
      const frequency = ({ 'Daily': 7, 'Twice a week': 2, 'Three times a week': 3, 'Once a week': 1 } as Record<string, number>)[value.frequency ?? ''] ?? Number(value.frequency);
      await firstValueFrom(this.booking.completeAssessment({ appointmentId: numericId(this.sessionId()), diagnosis: value.diagnosis ?? '',
        numberOfSessions: Number(value.totalSessions), frequencyPerWeek: frequency, doctorId: value.assignedDoctorId ?? '',
        treatmentType: this.context()!.treatmentType, exercises: value.exercises || null }));
      this.messages.add({ severity: 'success', summary: this.locale.text('SUCCESS', 'Success'), detail: this.locale.text('ASSESSMENT_SAVED', 'Assessment completed and treatment plan saved.') });
      this.form.markAsPristine();
      await this.router.navigate(['/senior/dashboard']);
    } catch (error) { this.error.set(this.locale.label(apiError(error)));this.messages.add({severity:'error',summary:this.locale.text('ERROR','Error'),detail:this.error()}); }
    finally { this.saving.set(false); }
  }
  selectDoctorFromList(id: string) { if(this.loading() || !this.context() || this.context()?.completedAt)return; this.form.patchValue({ assignedDoctorId: id }); this.form.markAsDirty(); }
  async saveDraft() {
    if (this.saving() || this.loading() || !this.context() || this.context()?.completedAt) return;
    this.saving.set(true); this.error.set('');
    try {
      const value = this.form.getRawValue();
      const frequency = ({'Daily':7,'Twice a week':2,'Three times a week':3,'Once a week':1} as Record<string,number>)[value.frequency ?? ''] ?? Number(value.frequency);
      const saved = await firstValueFrom(this.booking.saveAssessmentDraft({appointmentId:numericId(this.sessionId()), diagnosis:value.diagnosis ?? '',
        numberOfSessions:Number(value.totalSessions ?? 0), frequencyPerWeek:frequency, doctorId:value.assignedDoctorId ?? '', treatmentType:this.context()!.treatmentType, exercises:value.exercises || null}));
      this.context.set(saved); this.form.markAsPristine();
      this.messages.add({severity:'success',summary:this.locale.text('SUCCESS','Success'),detail:this.translate.instant('SENIOR.DRAFT_SAVED')});
    } catch (error) {
      this.error.set(this.locale.label(apiError(error)));
      this.messages.add({severity:'error',summary:this.locale.text('ERROR','Error'),detail:this.error()});
    } finally { this.saving.set(false); }
  }
  canLeave() { return !this.form.dirty || !!this.context()?.completedAt || globalThis.confirm(this.translate.instant('SENIOR.UNSAVED_DRAFT')); }
  @HostListener('window:beforeunload', ['$event']) beforeUnload(event: BeforeUnloadEvent) {
    if (this.form.dirty && !this.context()?.completedAt) { event.preventDefault(); event.returnValue = ''; }
  }
}
