import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '../../../core/services/language';
import { ClinicStateService } from '../../../core/services/state/clinic-state.service';
import { Session } from '../../../core/models/session.model';

/**
 * Represents a single item within a time slot — either a real patient session
 * or a dummy placeholder indicating an available slot.
 */
export interface SlotItem {
  type: 'patient' | 'available';
  session?: Session;
  patientName?: string;
  patientAvatar?: string;
  roomName?: string;
  sessionBadge?: string;
  sessionType?: string;
}

/**
 * Represents a grouped time slot containing up to 2 items (max 2 patients/hour).
 */
export interface TimeSlotGroup {
  label: string;       // e.g. "09:00 AM - 10:00 AM"
  sortKey: number;     // hour in 24h format for sorting
  items: SlotItem[];
}

/** Standard clinic working hours (8 AM – 5 PM) */
const WORKING_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16];

const MAX_PATIENTS_PER_SLOT = 2;

/** Simulated logged-in doctor */
const currentDoctorId = 'doc_1';

@Component({
  selector: 'app-doctor-dashboard',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  private router = inject(Router);
  private clinicState = inject(ClinicStateService);
  langService = inject(LanguageService);

  /**
   * Computed signal: filters ALL sessions from the global state to only those
   * assigned to the current doctor AND scheduled for today.
   */
  todaySessions = computed<Session[]>(() => {
    const now = new Date();
    const allSessions = this.clinicState.sessions();

    return allSessions.filter(s => {
      if (s.doctorId !== currentDoctorId) return false;
      if (!s.scheduledAt) return false;

      const sessionDate = new Date(s.scheduledAt);
      return (
        !isNaN(sessionDate.getTime()) &&
        sessionDate.getFullYear() === now.getFullYear() &&
        sessionDate.getMonth() === now.getMonth() &&
        sessionDate.getDate() === now.getDate()
      );
    });
  });

  /**
   * Computed signal: groups today's sessions into time slots (1-hour blocks).
   * Business rule: max 2 patients per slot.
   *  - 1 patient → pad with 1 "available" placeholder
   *  - 2 patients → slot is full
   *  - 0 patients in a working hour → show 2 available placeholders
   */
  groupedSlots = computed<TimeSlotGroup[]>(() => {
    const sessions = this.todaySessions();

    // Group sessions by their hour
    const slotMap = new Map<number, Session[]>();
    for (const session of sessions) {
      const hour = new Date(session.scheduledAt!).getHours();
      if (!slotMap.has(hour)) {
        slotMap.set(hour, []);
      }
      slotMap.get(hour)!.push(session);
    }

    // Ensure all working hours with sessions are represented,
    // plus any working hours that fall between the earliest and latest booked session
    const bookedHours = Array.from(slotMap.keys());
    const relevantHours = new Set<number>(bookedHours);

    // Also include standard working hours that have sessions
    for (const h of WORKING_HOURS) {
      if (slotMap.has(h)) {
        relevantHours.add(h);
      }
    }

    // If no sessions at all, show nothing (empty state)
    if (relevantHours.size === 0) {
      return [];
    }

    const groups: TimeSlotGroup[] = [];

    for (const hour of Array.from(relevantHours).sort((a, b) => a - b)) {
      const sessionsInSlot = slotMap.get(hour) || [];
      const items: SlotItem[] = [];

      // Build SlotItems for real patients
      for (const session of sessionsInSlot.slice(0, MAX_PATIENTS_PER_SLOT)) {
        items.push({
          type: 'patient',
          session,
          patientName: this.clinicState.getPatientName(session.patientId),
          patientAvatar: this.clinicState.getPatientAvatar(session.patientId),
          roomName: this.clinicState.getRoomName(session.roomId),
          sessionBadge: session.type === 'Assessment'
            ? 'ASSESSMENT'
            : this.clinicState.getSessionBadge(session),
          sessionType: session.type,
        });
      }

      // Pad remaining capacity with "available" placeholders
      while (items.length < MAX_PATIENTS_PER_SLOT) {
        items.push({ type: 'available' });
      }

      groups.push({
        label: this.formatTimeSlotLabel(hour),
        sortKey: hour,
        items,
      });
    }

    return groups;
  });

  /**
   * Navigates to the session notes route so the doctor can write clinical notes.
   */
  startSession(sessionId: string): void {
    this.router.navigate(['/doctor/session-notes', sessionId]);
  }

  /**
   * Returns the appropriate badge CSS class based on session type.
   */
  getBadgeClass(item: SlotItem): string {
    if (item.sessionType === 'Assessment' || item.sessionType === 'Re-Assessment') {
      return 'badge badge-warning';
    }
    return 'badge badge-info';
  }

  /**
   * Formats hour (0-23) into a human-readable time slot label.
   * e.g. 9 → "09:00 AM - 10:00 AM"
   */
  private formatTimeSlotLabel(hour: number): string {
    const startHour = hour % 12 || 12;
    const endRawHour = hour + 1;
    const endHour = endRawHour % 12 || 12;
    const startPeriod = hour < 12 ? 'AM' : 'PM';
    const endPeriod = endRawHour < 12 ? 'AM' : 'PM';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(startHour)}:00 ${startPeriod} - ${pad(endHour)}:00 ${endPeriod}`;
  }
}