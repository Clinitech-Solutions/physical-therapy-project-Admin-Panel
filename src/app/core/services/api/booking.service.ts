import { Injectable, signal } from '@angular/core';
import { WaitlistItem } from '../../models/waitlist.model';
import { DoctorAvailability, DoctorSlot } from '../../models/doctor.model';
import { Session, SessionStatus, SessionType } from '../../models/session.model';
import { mockWaitlist, mockDoctorAvailability, mockDoctorSlots, mockSessions, mockDoctors } from '../../mock-data/mock-db';

@Injectable({
  providedIn: 'root'
})
export class BookingService {
  private waitlistSignal = signal<WaitlistItem[]>([]);
  public waitlist = this.waitlistSignal.asReadonly();
  
  private doctorsSignal = signal<DoctorAvailability[]>([]);
  public doctors = this.doctorsSignal.asReadonly();
  
  private doctorSlotsSignal = signal<DoctorSlot[]>([]);
  public doctorSlots = this.doctorSlotsSignal.asReadonly();

  private sessionsSignal = signal<Session[]>([]);
  public sessions = this.sessionsSignal.asReadonly();

  public loading = signal<boolean>(false);
  public searching = signal<boolean>(false);

  constructor() {
    this.fetchInitialData();
  }

  async fetchInitialData() {
    this.loading.set(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    this.waitlistSignal.set([...mockWaitlist]);
    this.doctorsSignal.set([...mockDoctorAvailability]);
    this.sessionsSignal.set([...mockSessions]);
    this.loading.set(false);
  }

  async fillWaitlistSlot(patientId: string) {
    this.loading.set(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    this.waitlistSignal.update(list => list.filter(item => item.patientId !== patientId));
    this.loading.set(false);
  }

  async searchSlots(genderPref: string) {
    this.searching.set(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Join with mockDoctors to filter by gender
    this.doctorSlotsSignal.set([...mockDoctorSlots].filter(slot => {
      if (genderPref === 'Any') return true;
      const doc = mockDoctors.find(d => d.id === slot.doctorId);
      return doc?.gender === genderPref;
    }));
    
    this.searching.set(false);
  }

  async addSession(sessionData: { patientId: string, doctorId: string, roomId: string, scheduledAt: string, type: SessionType }) {
    this.loading.set(true);
    await new Promise(resolve => setTimeout(resolve, 800)); // Network delay

    const newSession: Session = {
      id: Date.now().toString(),
      patientId: sessionData.patientId,
      doctorId: sessionData.doctorId,
      roomId: sessionData.roomId,
      scheduledAt: sessionData.scheduledAt,
      type: sessionData.type,
      status: 'Confirmed' as SessionStatus,
      packageAlert: sessionData.type === 'Assessment' ? undefined : 'Session 1 of 10'
    };

    this.sessionsSignal.update(sessions => [...sessions, newSession]);
    
    // Remove from waitlist if applicable
    this.waitlistSignal.update(list => list.filter(item => item.patientId !== sessionData.patientId));
    
    this.loading.set(false);
  }
}
