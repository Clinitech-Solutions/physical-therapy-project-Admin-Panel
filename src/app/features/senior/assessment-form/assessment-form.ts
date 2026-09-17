import { Component, inject, computed, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ClinicStateService } from '../../../core/services/state/clinic-state.service';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-assessment-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './assessment-form.html',
  styleUrl: './assessment-form.css',
})
export class AssessmentForm implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private clinicState = inject(ClinicStateService);
  private messageService = inject(MessageService);

  patientId = signal<string>('');
  sessionId = signal<string>('');

  form: FormGroup = this.fb.group({
    diagnosis: ['', Validators.required],
    totalSessions: [1, [Validators.required, Validators.min(1)]],
    frequency: ['', Validators.required],
    assignedDoctorId: ['', Validators.required],
    exercises: ['']
  });

  // Derived state for the patient
  patient = computed(() => {
    const pId = this.patientId();
    return this.clinicState.patients().find(p => p.id === pId);
  });

  // Smart doctor selection list
  smartDoctors = computed(() => {
    const p = this.patient();
    if (!p) return [];

    const doctors = this.clinicState.doctors();
    const availability = this.clinicState.doctorAvailability();

    return doctors.map(doc => {
      const avail = availability.find(a => a.doctorId === doc.id);
      const currentLoad = avail?.currentLoad || 0;
      
      const isGenderMatch = doc.gender === p.gender;
      const isAvailable = currentLoad < 2; // Threshold for availability
      const isRecommended = isGenderMatch && isAvailable;

      return {
        ...doc,
        currentLoad,
        isGenderMatch,
        isRecommended
      };
    }).sort((a, b) => {
      // Sort recommended to top
      if (a.isRecommended && !b.isRecommended) return -1;
      if (!a.isRecommended && b.isRecommended) return 1;
      // Then by load
      return a.currentLoad - b.currentLoad;
    });
  });

  // Derived age from DOB if available
  patientAge = computed(() => {
    return '--'; // dob is not available on Patient interface in this app version
  });

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.patientId.set(params['patientId'] || '');
      this.sessionId.set(params['sessionId'] || '');
    });
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const val = this.form.value;
    const pId = this.patientId();
    const sId = this.sessionId();
    const currentPatient = this.patient();

    // 1. Update Patient Profile (treatment plan & primary doctor)
    if (currentPatient) {
      const updatedPatient = {
        ...currentPatient,
        assignedDoctorId: val.assignedDoctorId,
        treatmentPlan: {
          ...currentPatient.treatmentPlan,
          primaryDoctorId: val.assignedDoctorId,
          diagnosis: val.diagnosis,
          totalSessions: val.totalSessions,
          sessionsCompleted: 0
        }
      };
      this.clinicState.updatePatient(currentPatient.id, updatedPatient);
    }

    // 2. Mark the Assessment Session as Completed
    if (sId) {
      const session = this.clinicState.sessions().find(s => s.id === sId);
      if (session) {
        this.clinicState.updateSessionStatus(sId, 'Completed');
      }
    }

    // 3. Success Feedback
    this.messageService.add({ 
      severity: 'success', 
      summary: 'Success', 
      detail: 'Assessment recorded & Treatment Plan initialized.' 
    });

    // 4. Navigate back to dashboard
    this.router.navigate(['/senior/dashboard']);
  }

  selectDoctorFromList(doctorId: string): void {
    this.form.patchValue({ assignedDoctorId: doctorId });
    this.messageService.add({ 
      severity: 'info', 
      summary: 'Doctor Selected', 
      detail: 'The selected doctor has been assigned to the treatment plan.' 
    });
  }
}
