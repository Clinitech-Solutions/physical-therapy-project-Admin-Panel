import { Component, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { LanguageService } from "../../../core/services/language";
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';

import { SessionService } from '../../../core/services/api/session.service';
import { Session } from '../../../core/models/session.model';
import { MessageService } from 'primeng/api';

@Component({
  selector: "app-receptionist-dashboard",
  standalone: true,
  imports: [CommonModule, TranslateModule, FormsModule],
  templateUrl: "./dashboard.html",
  styleUrl: "./dashboard.css",
})
export class Dashboard {
  langService = inject(LanguageService);

  // KPIs
  kpis = {
    todaysSessions: 24,
    presentDoctors: 6,
    walkInsToday: 3,
    pendingPayments: 5
  };

  sessionService = inject(SessionService);
  messageService = inject(MessageService);
  sessions = this.sessionService.sessions;

  // Filters
  filterDoctor = signal<string>('');
  filterRoom = signal<string>('');
  searchPatient = signal<string>('');

  // Absence Modal State
  showAbsenceModal = signal(false);
  absentDoctorName = signal('');
  isProcessing = signal(false);
  
  openAbsenceModal(doctorName: string) {
    this.absentDoctorName.set(doctorName);
    this.showAbsenceModal.set(true);
  }

  closeAbsenceModal() {
    this.showAbsenceModal.set(false);
    this.absentDoctorName.set('');
  }

  confirmCoverage() {
    this.isProcessing.set(true);
    setTimeout(() => {
      this.isProcessing.set(false);
      this.closeAbsenceModal();
      this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Doctor marked absent' });
    }, 1000);
  }

  async checkIn(id: string) {
    await this.sessionService.checkIn(id);
    this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Patient checked in' });
  }

  async checkOut(id: string) {
    await this.sessionService.checkOut(id);
    this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Patient checked out' });
  }
}
