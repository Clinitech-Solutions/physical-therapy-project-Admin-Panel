import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ClinicStateService } from '../../../core/services/state/clinic-state.service';

/**
 * LiveDashboard — Senior Therapist's real-time operational view.
 *
 * Architecture:
 *  - NO isolated mock data or feature-level services.
 *  - All data is derived as computed() signals from the global ClinicStateService.
 *  - The component is a pure "View" layer over the shared clinic state.
 */
@Component({
  selector: 'app-live-dashboard',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './live-dashboard.html',
  styleUrl: './live-dashboard.css',
})
export class LiveDashboard {
  private clinicState = inject(ClinicStateService);
  private router = inject(Router);

  // ── Tab State ──────────────────────────────────────────────
  activeTab = signal<'assessments' | 'reassessments'>('assessments');

  // ── Helper: today's date string (YYYY-MM-DD) ──────────────
  private todayString = computed(() => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  });

  // ── Business Rule 1: Today's Assessments ──────────────────
  // New patients who have their first-ever Assessment today and it's not yet completed.
  todayAssessments = computed(() => {
    const today = this.todayString();
    const sessions = this.clinicState.sessions();
    const patients = this.clinicState.patients();

    return sessions
      .filter(s => {
        if (s.type !== 'Assessment') return false;
        if (s.status === 'Completed' || s.status === 'Cancelled') return false;
        if (!s.scheduledAt) return false;
        return s.scheduledAt.startsWith(today);
      })
      .map(s => {
        const patient = patients.find(p => p.id === s.patientId);
        return {
          sessionId: s.id,
          patientId: s.patientId,
          patientName: patient?.nameEn ?? 'Unknown Patient',
          avatarInitials: patient?.avatar ?? '??',
          scheduledTime: this.formatTime(s.scheduledAt!),
          status: s.status,
          doctorName: this.clinicState.getDoctorName(s.doctorId),
          type: 'Assessment' as const,
        };
      });
  });

  // ── Business Rule 1b: Today's Re-Assessments ─────────────
  // strictly fetches Re-Assessment tasks.
  todayReassessments = computed(() => {
    const today = this.todayString();
    const sessions = this.clinicState.sessions();
    const patients = this.clinicState.patients();

    return sessions
      .filter(s => {
        if (s.type !== 'Re-Assessment') return false;
        if (s.status === 'Completed' || s.status === 'Cancelled') return false;
        if (!s.scheduledAt) return false;
        return s.scheduledAt.startsWith(today);
      })
      .map(s => {
        const patient = patients.find(p => p.id === s.patientId);
        return {
          sessionId: s.id,
          patientId: s.patientId,
          patientName: patient?.nameEn ?? 'Unknown Patient',
          avatarInitials: patient?.avatar ?? '??',
          scheduledTime: this.formatTime(s.scheduledAt!),
          status: s.status,
          doctorName: this.clinicState.getDoctorName(s.doctorId),
          sessionBadge: this.clinicState.getSessionBadge(s),
          type: 'Re-Assessment' as const,
        };
      });
  });

  // ── KPI Counts ─────────────────────────────────────────────
  assessmentCount = computed(() => this.todayAssessments().length);
  reassessmentCount = computed(() => this.todayReassessments().length);
  totalPendingTasks = computed(() => this.assessmentCount() + this.reassessmentCount());

  // ── Active Tab Tasks (what the template iterates over) ─────
  activeTasks = computed(() => {
    return this.activeTab() === 'assessments'
      ? this.todayAssessments()
      : this.todayReassessments();
  });

  // ── Business Rule 2: Doctor Workload (Live View Capacity) ──
  activeDoctorsWorkload = computed(() => {
    const availability = this.clinicState.doctorAvailability();
    const doctors = this.clinicState.doctors();

    return availability.map(a => {
      const doctor = doctors.find(d => d.id === a.doctorId);
      const maxLoad = 2; // Clinic policy: max 2 concurrent patients per doctor

      // Dynamic border color based on current load
      let borderColor: string;
      let loadClass: string;
      if (a.currentLoad === 0) {
        borderColor = 'var(--mq-teal)';
        loadClass = 'load-0';
      } else if (a.currentLoad === 1) {
        borderColor = 'var(--color-warning)';
        loadClass = 'load-1';
      } else {
        borderColor = 'var(--color-danger)';
        loadClass = 'load-2';
      }

      return {
        doctorId: a.doctorId,
        name: doctor?.name ?? 'Unknown Doctor',
        currentLoad: a.currentLoad,
        maxLoad,
        borderColor,
        loadClass,
        roomId: a.roomId,
        roomName: this.clinicState.getRoomName(a.roomId),
      };
    });
  });

  // ── KPI: Available / Busy / Full doctors ───────────────────
  availableDoctorsCount = computed(() =>
    this.activeDoctorsWorkload().filter(d => d.currentLoad === 0).length
  );
  busyDoctorsCount = computed(() =>
    this.activeDoctorsWorkload().filter(d => d.currentLoad > 0).length
  );

  // ── Tab Switching ──────────────────────────────────────────
  switchTab(tab: 'assessments' | 'reassessments'): void {
    this.activeTab.set(tab);
  }

  // ── Business Rule 3: Start Assessment → Navigate ──────────
  startTask(task: { sessionId: string; patientId: string; type: 'Assessment' | 'Re-Assessment' }): void {
    const route = task.type === 'Assessment'
      ? '/senior/assessment-form'
      : '/senior/re-assessment-form';

    this.router.navigate([route], {
      queryParams: {
        patientId: task.patientId,
        sessionId: task.sessionId,
      },
    });
  }

  // ── Utility: Format ISO time to HH:MM AM/PM ──────────────
  private formatTime(isoString: string): string {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '--:--';
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 || 12;
    return `${displayHour}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  }

  // ── Status badge class mapping ─────────────────────────────
  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'In Progress': return 'badge-info';
      case 'Confirmed': return 'badge-success';
      case 'Pending': return 'badge-warning';
      case 'Completed': return 'badge-success';
      case 'Cancelled': return 'badge-danger';
      default: return 'badge-neutral';
    }
  }
}
