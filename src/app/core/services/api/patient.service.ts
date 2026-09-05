import { Injectable, signal } from '@angular/core';
import { Patient, NewPatient } from '../../models/patient.model';
import { mockPatients } from '../../mock-data/mock-db';

@Injectable({
  providedIn: 'root'
})
export class PatientService {
  private patientsSignal = signal<Patient[]>([]);
  public patients = this.patientsSignal.asReadonly();
  public loading = signal<boolean>(false);

  constructor() {
    this.fetchPatients();
  }

  async fetchPatients() {
    this.loading.set(true);
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    this.patientsSignal.set([...mockPatients]);
    this.loading.set(false);
  }

  async createPatient(newPatient: NewPatient) {
    this.loading.set(true);
    await new Promise(resolve => setTimeout(resolve, 800)); // Simulate longer network delay

    const avatarStr = newPatient.nameEn.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    
    const created: Patient = {
      id: Date.now().toString(),
      nameEn: newPatient.nameEn || 'New Patient',
      nameAr: newPatient.nameAr || 'مريض جديد',
      avatar: avatarStr || 'NP',
      gender: newPatient.gender as 'Male' | 'Female',
      phone: newPatient.phone,
      paymentType: newPatient.paymentType as 'Cash' | 'Online' | 'Insurance',
      lastVisit: new Date().toISOString(),
      documents: { ...newPatient.docs }
    };

    this.patientsSignal.update(patients => [created, ...patients]);
    this.loading.set(false);
  }

  async updatePatient(id: string, updatedData: Partial<Patient>) {
    this.loading.set(true);
    await new Promise(resolve => setTimeout(resolve, 800)); // Simulate network delay

    this.patientsSignal.update(patients => 
      patients.map(p => p.id === id ? { ...p, ...updatedData } : p)
    );
    this.loading.set(false);
  }
}
