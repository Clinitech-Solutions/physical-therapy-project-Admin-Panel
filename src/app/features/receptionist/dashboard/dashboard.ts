import { Component, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { LanguageService } from "../../../core/services/language";
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';

interface SessionRow {
  id: string;
  time: string;
  patientName: string;
  patientAvatar: string;
  doctorName: string;
  room: string;
  status: 'Confirmed' | 'In Progress' | 'Pending' | 'Cancelled' | 'Waiting' | 'Completed';
  packageAlert?: string;
}

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

  // Timeline Data
  sessions = signal<SessionRow[]>([
    { id: '1', time: '09:00 AM', patientName: 'Ahmed Fathy', patientAvatar: 'AF', doctorName: 'Dr. Sarah', room: 'Room 1', status: 'Confirmed', packageAlert: 'Session 12 of 12' },
    { id: '2', time: '09:00 AM', patientName: 'Mona Zaki', patientAvatar: 'MZ', doctorName: 'Dr. Omar', room: 'Room 2', status: 'In Progress' },
    { id: '3', time: '10:00 AM', patientName: 'Ali Hassan', patientAvatar: 'AH', doctorName: 'Dr. Sarah', room: 'Room 1', status: 'Pending' },
    { id: '4', time: '10:30 AM', patientName: 'Nour El Din', patientAvatar: 'NE', doctorName: 'Dr. Omar', room: 'Room 2', status: 'Cancelled' },
    { id: '5', time: '11:00 AM', patientName: 'Laila Tarek', patientAvatar: 'LT', doctorName: 'Dr. Youssef', room: 'Room 3', status: 'Completed' },
  ]);

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
    }, 1000);
  }

  checkIn(id: string) {
    this.sessions.update(sessions => 
      sessions.map(s => s.id === id ? { ...s, status: 'In Progress' } : s)
    );
  }

  checkOut(id: string) {
    this.sessions.update(sessions => 
      sessions.map(s => s.id === id ? { ...s, status: 'Completed' } : s)
    );
  }
}
