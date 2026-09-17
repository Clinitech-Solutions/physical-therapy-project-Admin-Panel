import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ClinicStateService } from '../../../core/services/state/clinic-state.service';
import { MessageService } from 'primeng/api';
import { Patient } from '../../../core/models/patient.model';

@Component({
  selector: 'app-re-assessment-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './re-assessment-form.html',
  styleUrls: ['./re-assessment-form.css']
})
export class ReAssessmentForm implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private clinicState = inject(ClinicStateService);
  private fb = inject(FormBuilder);
  private messageService = inject(MessageService);

  patientId = signal<string>('');
  sessionId = '';

  // Signal for the patient data
  patient = computed(() => {
    const pId = this.patientId();
    return this.clinicState.patients().find(p => p.id === pId);
  });

  form!: FormGroup;

  ngOnInit(): void {
    this.patientId.set(this.route.snapshot.paramMap.get('patientId') || '');
    this.sessionId = this.route.snapshot.paramMap.get('sessionId') || '';

    this.initForm();
  }

  private initForm(): void {
    this.form = this.fb.group({
      progressNotes: ['', Validators.required],
      clinicalDecision: ['', Validators.required],
      additionalSessions: [null],
      adjustedExercises: ['']
    });

    // Handle dynamic validation based on clinicalDecision
    this.form.get('clinicalDecision')?.valueChanges.subscribe(decision => {
      const additionalSessionsCtrl = this.form.get('additionalSessions');
      const adjustedExercisesCtrl = this.form.get('adjustedExercises');

      if (decision === 'Discharge') {
        additionalSessionsCtrl?.clearValidators();
        additionalSessionsCtrl?.setValue(null);
        additionalSessionsCtrl?.disable();

        adjustedExercisesCtrl?.setValue('');
        adjustedExercisesCtrl?.disable();
      } else {
        additionalSessionsCtrl?.setValidators([Validators.required, Validators.min(1)]);
        additionalSessionsCtrl?.enable();
        adjustedExercisesCtrl?.enable();
      }
      
      additionalSessionsCtrl?.updateValueAndValidity();
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const val = this.form.value;
    const currentPatient = this.patient();
    
    if (currentPatient) {
      // Create an updated treatment plan keeping the old data and appending the new sessions if applicable
      const oldTreatmentPlan: any = currentPatient.treatmentPlan || {};
      
      let newTotalSessions = oldTreatmentPlan.totalSessions || 0;
      if (val.clinicalDecision !== 'Discharge' && val.additionalSessions) {
        newTotalSessions += val.additionalSessions;
      }

      const updatedPatient: Partial<Patient> = {
        treatmentPlan: {
          ...oldTreatmentPlan,
          totalSessions: newTotalSessions,
          progressNotes: val.progressNotes,
          clinicalDecision: val.clinicalDecision,
          exercises: val.adjustedExercises ? val.adjustedExercises : oldTreatmentPlan.exercises
        }
      };
      
      this.clinicState.updatePatient(currentPatient.id, updatedPatient);
    }

    // Mark the Re-Assessment Session as Completed
    if (this.sessionId) {
      this.clinicState.updateSessionStatus(this.sessionId, 'Completed');
    }

    this.messageService.add({ 
      severity: 'success', 
      summary: 'Success', 
      detail: 'Re-assessment recorded successfully.' 
    });

    this.router.navigate(['/senior/dashboard']);
  }
}
