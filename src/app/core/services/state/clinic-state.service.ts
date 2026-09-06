import { Injectable, signal } from '@angular/core';
import { Patient, NewPatient } from '../../models/patient.model';
import { Doctor, DoctorAvailability, DoctorSlot } from '../../models/doctor.model';
import { Room } from '../../models/room.model';
import { Session, SessionStatus, SessionType } from '../../models/session.model';
import { InsuranceClaim } from '../../models/insurance.model';
import { Invoice } from '../../models/invoice.model';
import { WaitlistItem } from '../../models/waitlist.model';
import { 
  mockPatients, 
  mockDoctors, 
  mockRooms, 
  mockSessions, 
  mockInsuranceClaims, 
  mockInvoices, 
  mockWaitlist, 
  mockDoctorAvailability, 
  mockDoctorSlots 
} from '../../mock-data/mock-db';

@Injectable({
  providedIn: 'root'
})
export class ClinicStateService {
  // Global State Signals
  private patientsSig = signal<Patient[]>([]);
  public patients = this.patientsSig.asReadonly();

  private doctorsSig = signal<Doctor[]>([]);
  public doctors = this.doctorsSig.asReadonly();

  private roomsSig = signal<Room[]>([]);
  public rooms = this.roomsSig.asReadonly();

  private sessionsSig = signal<Session[]>([]);
  public sessions = this.sessionsSig.asReadonly();

  private waitlistSig = signal<WaitlistItem[]>([]);
  public waitlist = this.waitlistSig.asReadonly();

  private claimsSig = signal<InsuranceClaim[]>([]);
  public claims = this.claimsSig.asReadonly();

  private invoicesSig = signal<Invoice[]>([]);
  public invoices = this.invoicesSig.asReadonly();

  private doctorAvailabilitySig = signal<DoctorAvailability[]>([]);
  public doctorAvailability = this.doctorAvailabilitySig.asReadonly();

  private doctorSlotsSig = signal<DoctorSlot[]>([]);
  public doctorSlots = this.doctorSlotsSig.asReadonly();

  // Loading States
  public isLoading = signal<boolean>(false);
  public isSearching = signal<boolean>(false);
  public isProcessingPayment = signal<boolean>(false);

  constructor() {
    this.initializeState();
  }

  private async initializeState() {
    this.isLoading.set(true);
    // Simulate network delay for initial load
    await new Promise(resolve => setTimeout(resolve, 500));
    
    this.patientsSig.set([...mockPatients]);
    this.doctorsSig.set([...mockDoctors]);
    this.roomsSig.set([...mockRooms]);
    this.sessionsSig.set([...mockSessions]);
    this.waitlistSig.set([...mockWaitlist]);
    this.claimsSig.set([...mockInsuranceClaims]);
    this.invoicesSig.set([...mockInvoices]);
    this.doctorAvailabilitySig.set([...mockDoctorAvailability]);
    this.doctorSlotsSig.set([...mockDoctorSlots]);
    
    this.isLoading.set(false);
  }

  // ==========================================
  // Interconnected Business Logic
  // ==========================================

  async checkInPatient(sessionId: string) {
    this.isLoading.set(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // 1. Find the session
    const sessions = this.sessionsSig();
    const sessionToUpdate = sessions.find(s => s.id === sessionId);
    
    if (!sessionToUpdate) {
      this.isLoading.set(false);
      return;
    }

    // Update Session Status
    this.sessionsSig.update(list => list.map(s => s.id === sessionId ? { ...s, status: 'In Progress' } : s));

    // 2. Update Room Status
    this.roomsSig.update(list => list.map(r => {
      if (r.id === sessionToUpdate.roomId) {
        return { ...r, currentLoad: 1, status: 'Occupied' };
      }
      return r;
    }));

    // 3. Remove from Waitlist (if applicable)
    this.waitlistSig.update(list => list.filter(w => w.patientId !== sessionToUpdate.patientId));

    this.isLoading.set(false);
  }

  async checkOutPatient(sessionId: string) {
    this.isLoading.set(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const sessions = this.sessionsSig();
    const sessionToUpdate = sessions.find(s => s.id === sessionId);
    
    if (sessionToUpdate) {
      this.sessionsSig.update(list => list.map(s => s.id === sessionId ? { ...s, status: 'Completed' } : s));

      // Decrease Room Load
      this.roomsSig.update(list => list.map(r => {
        if (r.id === sessionToUpdate.roomId) {
          const newLoad = Math.max(0, r.currentLoad - 1);
          return { ...r, currentLoad: newLoad, status: 'Available' };
        }
        return r;
      }));
    }
    
    this.isLoading.set(false);
  }

  // ==========================================
  // Booking Logic
  // ==========================================

  async searchSlots(genderPref: string) {
    this.isSearching.set(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const docs = this.doctorsSig();
    this.doctorSlotsSig.set([...mockDoctorSlots].filter(slot => {
      if (genderPref === 'Any') return true;
      const doc = docs.find(d => d.id === slot.doctorId);
      return doc?.gender === genderPref;
    }));
    
    this.isSearching.set(false);
  }

  async addSession(sessionData: { patientId: string, doctorId: string, roomId: string, scheduledAt: string, type: SessionType }) {
    this.isLoading.set(true);
    await new Promise(resolve => setTimeout(resolve, 500));

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

    this.sessionsSig.update(sessions => [...sessions, newSession]);
    this.waitlistSig.update(list => list.filter(item => item.patientId !== sessionData.patientId));
    this.isLoading.set(false);
  }

  // ==========================================
  // Room Logic
  // ==========================================

  async reassignRoom(roomId: string, doctorId: string | null) {
    this.isLoading.set(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    this.roomsSig.update(rooms => rooms.map(r => {
      if (r.id === roomId) {
        return { ...r, doctorId: doctorId };
      }
      return r;
    }));
    this.isLoading.set(false);
  }

  async changeRoomStatus(roomId: string, status: 'Available' | 'Occupied' | 'Maintenance') {
    this.isLoading.set(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    this.roomsSig.update(rooms => rooms.map(r => {
      if (r.id === roomId) {
        if (status === 'Maintenance') {
          return { ...r, status: 'Maintenance', doctorId: null, currentLoad: 0 };
        } else if (status === 'Available') {
          return { ...r, status: 'Available', currentLoad: 0 };
        } else if (status === 'Occupied') {
          return { ...r, status: 'Occupied', currentLoad: 1 };
        }
      }
      return r;
    }));
    this.isLoading.set(false);
  }

  // ==========================================
  // Patient Logic
  // ==========================================

  async createPatient(newPatient: NewPatient) {
    this.isLoading.set(true);
    await new Promise(resolve => setTimeout(resolve, 600));

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

    this.patientsSig.update(patients => [created, ...patients]);
    this.isLoading.set(false);
  }

  async updatePatient(id: string, updatedData: Partial<Patient>) {
    this.isLoading.set(true);
    await new Promise(resolve => setTimeout(resolve, 600));

    this.patientsSig.update(patients => 
      patients.map(p => p.id === id ? { ...p, ...updatedData } : p)
    );
    this.isLoading.set(false);
  }

  // ==========================================
  // Insurance & Billing Logic
  // ==========================================

  async submitClaim(id: string) {
    this.isLoading.set(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    this.claimsSig.update(claims =>
      claims.map(c => c.id === id ? { ...c, status: 'Submitted', missingDocs: [] } : c)
    );
    this.isLoading.set(false);
  }

  async saveCopay(id: string, copayAmount: number) {
    this.isLoading.set(true);
    await new Promise(resolve => setTimeout(resolve, 600));
    this.claimsSig.update(claims =>
      claims.map(c => c.id === id ? { ...c, copay: copayAmount, status: 'Approved' } : c)
    );
    this.isLoading.set(false);
  }

  async processPayment(invoiceId: string) {
    this.isProcessingPayment.set(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    this.invoicesSig.update(invs =>
      invs.map(inv => inv.id === invoiceId ? { ...inv, status: 'Paid' } : inv)
    );
    this.isProcessingPayment.set(false);
  }

  // ==========================================
  // UI Helper Methods (ID to Name Resolution)
  // ==========================================

  getPatientName(id: string | null): string {
    if (!id) return 'Unknown Patient';
    const p = this.patientsSig().find(x => x.id === id);
    return p ? p.nameEn : 'Unknown Patient';
  }

  getPatientAvatar(id: string | null): string {
    if (!id) return '';
    const p = this.patientsSig().find(x => x.id === id);
    return p ? p.avatar : '';
  }

  getPatientPhone(id: string | null): string {
    if (!id) return '';
    const p = this.patientsSig().find(x => x.id === id);
    return p ? p.phone : '';
  }

  getDoctorName(id: string | null): string {
    if (!id) return 'Unassigned';
    const d = this.doctorsSig().find(x => x.id === id);
    return d ? d.name : 'Unassigned';
  }

  getDoctorGender(id: string | null): string {
    if (!id) return '';
    const d = this.doctorsSig().find(x => x.id === id);
    return d ? d.gender : '';
  }

  getRoomName(id: string | null): string {
    if (!id) return 'No Room';
    const r = this.roomsSig().find(x => x.id === id);
    return r ? r.displayName : 'No Room';
  }

  getRoomCapacity(id: string | null): number {
    if (!id) return 0;
    const r = this.roomsSig().find(x => x.id === id);
    return r ? r.capacity : 0;
  }
}
