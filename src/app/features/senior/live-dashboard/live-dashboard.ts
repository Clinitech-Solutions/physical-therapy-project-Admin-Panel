import {ReassessmentQueue} from '../../../shared/components/reassessment-queue/reassessment-queue';
import { Component, inject, computed, signal, OnInit, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { firstValueFrom, interval } from 'rxjs';
import { AppointmentService } from '../../../core/services/appointment.service';
import { AppointmentWorkflowService } from '../../../core/services/appointment-workflow.service';
import { BookingService } from '../../../core/services/booking.service';
import { BookingClinician } from '../../../core/models/booking.model';
import { AuthService } from '../../../core/services/auth';
import { ReceptionContracts } from '../../../core/services/reception-contracts';
import { apiError, localDay, numericId } from '../../../core/services/reception-api';
import { ReceptionistLocale, ReceptionistTextPipe } from '../../../shared/receptionist-locale';

@Component({ selector: 'app-live-dashboard', standalone: true,
  imports: [ReassessmentQueue,CommonModule, TranslateModule, ReceptionistTextPipe], templateUrl: './live-dashboard.html', styleUrl: './live-dashboard.css' })
export class LiveDashboard implements OnInit {
  private appointments = inject(AppointmentService);
  private workflow = inject(AppointmentWorkflowService);
  private booking = inject(BookingService);
  private auth = inject(AuthService);
  private contracts = inject(ReceptionContracts);
  private router = inject(Router);
  readonly locale = new ReceptionistLocale();
  readonly error = signal(''); readonly busy = signal(false); readonly doctors = signal<BookingClinician[]>([]);
  readonly loading = this.appointments.loading;
  private destroy=inject(DestroyRef);
  readonly capacityLoading=signal(false);
  readonly capacityError=signal('');
  activeTab = signal<'assessments' | 'reassessments'>('assessments');
  readonly reviewCount=signal<number|null>(null);
  ngOnInit() {
    this.appointments.getAppointments({ date: new Date().toISOString() });
    this.refreshCapacity();
    interval(30000).pipe(takeUntilDestroyed(this.destroy)).subscribe(()=>{if(!document.hidden&&!this.capacityLoading())this.refreshCapacity();});
  }
  refreshCapacity(){this.capacityLoading.set(true);this.capacityError.set('');this.booking.workload().subscribe({next:doctors=>{this.doctors.set(doctors);this.capacityLoading.set(false);},error:error=>{this.capacityError.set(apiError(error));this.capacityLoading.set(false);}});}
  private tasks(type: string) {
    const user = this.auth.currentUser();
    const supervisor = user?.roles.some(r => r === 'Ceo');
    return this.appointments.appointments().filter(a => a.appointmentType === type && !a.assessmentCompleted && localDay(a.startTime) === localDay(new Date()) &&
      (supervisor || a.seniorId === user?.id) && ['Pending', 'In Progress'].includes(this.contracts.label('appointmentStatus', a.status)))
      .map(a => ({ sessionId: String(a.id), patientId: String(a.patientId), patientName: a.patientName ?? '',
        avatarInitials: (a.patientName ?? '').split(/\s+/).map(n => n[0]).join('').slice(0, 2),
        scheduledTime: new Date(a.startTime).toLocaleTimeString(this.locale.language, { hour: '2-digit', minute: '2-digit' }),
        status: this.contracts.label('appointmentStatus', a.status), doctorName: a.doctorName ?? '',
        sessionBadge: '', type: type as 'Assessment' | 'Re-Assessment' }));
  }
  todayAssessments = computed(() => this.tasks('Assessment'));
  todayReassessments = computed(() => this.tasks('Re-Assessment'));
  assessmentCount = computed(() => this.todayAssessments().length);
  reassessmentCount = computed(() => this.todayReassessments().length);
  totalPendingTasks = computed(() => this.reviewCount()===null||this.loading()||this.error()?null:this.assessmentCount()+this.reviewCount()!);
  activeTasks = computed(() => this.activeTab() === 'assessments' ? this.todayAssessments() : this.todayReassessments());
  activeDoctorsWorkload = computed(() => this.doctors().map(d => ({ doctorId: d.id, name: d.name, currentLoad: d.currentLoad,
    maxLoad: 2, borderColor: d.currentLoad < 2 ? 'var(--mq-teal)' : 'var(--color-warning)', loadClass: 'load-'+Math.min(2,d.currentLoad), roomId: null })));
  availableDoctorsCount = computed(() => this.activeDoctorsWorkload().filter(d => d.currentLoad < 2).length);
  busyDoctorsCount = computed(() => this.activeDoctorsWorkload().filter(d => d.currentLoad >= 2).length);
  switchTab(tab: 'assessments' | 'reassessments') { this.activeTab.set(tab); }
  async startTask(task: { sessionId: string; patientId: string; type: 'Assessment' | 'Re-Assessment' }) {
    if (this.busy()) return;
    this.busy.set(true); this.error.set('');
    try {
      const appointment = this.appointments.appointments().find(a => String(a.id) === task.sessionId);
      if (!appointment) throw new Error(this.locale.text('APPOINTMENT_NOT_FOUND', 'Appointment was not found.'));
      if (this.contracts.label('appointmentStatus', appointment.status) === 'Pending') await firstValueFrom(this.workflow.transition(numericId(task.sessionId), 'In Progress'));
      await this.router.navigate([task.type === 'Assessment' ? '/senior/assessment-form' : '/senior/re-assessment-form'],
        { queryParams: { patientId: task.patientId, sessionId: task.sessionId } });
    } catch (error) { this.error.set(apiError(error)); }
    finally { this.busy.set(false); }
  }
  getStatusBadgeClass(status: string) { return status === 'In Progress' ? 'badge-info' : 'badge-warning'; }
}
