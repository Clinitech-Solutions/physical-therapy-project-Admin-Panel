import { Injectable, signal } from '@angular/core';
import { Doctor } from '../../models/doctor.model';
import { mockDoctors } from '../../mock-data/mock-db';

@Injectable({
  providedIn: 'root'
})
export class DoctorService {
  private doctorsSignal = signal<Doctor[]>([]);
  public doctors = this.doctorsSignal.asReadonly();
  public loading = signal<boolean>(false);

  constructor() {
    this.fetchDoctors();
  }

  async fetchDoctors() {
    this.loading.set(true);
    await new Promise(resolve => setTimeout(resolve, 200));
    this.doctorsSignal.set([...mockDoctors]);
    this.loading.set(false);
  }
}
