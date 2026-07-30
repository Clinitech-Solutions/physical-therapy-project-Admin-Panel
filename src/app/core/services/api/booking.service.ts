import { Injectable, signal } from '@angular/core';
import { WaitlistItem } from '../../models/waitlist.model';
import { DoctorAvailability, DoctorSlot } from '../../models/doctor.model';
import { mockWaitlist, mockDoctorAvailability, mockDoctorSlots } from '../../mock-data/mock-db';

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
    this.loading.set(false);
  }

  async fillWaitlistSlot(patientName: string) {
    this.loading.set(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    this.waitlistSignal.update(list => list.filter(item => item.patient !== patientName));
    this.loading.set(false);
  }

  async searchSlots(genderPref: string) {
    this.searching.set(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    this.doctorSlotsSignal.set([...mockDoctorSlots].filter(r => 
      (genderPref === 'Any' || r.doctorGender === genderPref)
    ));
    this.searching.set(false);
  }
}
