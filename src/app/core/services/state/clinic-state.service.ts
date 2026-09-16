import { Injectable, signal, computed } from '@angular/core';
import { Patient, NewPatient } from '../../models/patient.model';
import { Doctor, DoctorAvailability, DoctorSlot } from '../../models/doctor.model';
import { Room } from '../../models/room.model';
import { Session, SessionStatus, SessionType } from '../../models/session.model';
import { Invoice } from '../../models/invoice.model';
import { WaitlistItem } from '../../models/waitlist.model';
import { 
  mockPatients, 
  mockDoctors, 
  mockRooms, 
  mockSessions, 
  mockInvoices, 
  mockWaitlist, 
  mockDoctorAvailability, 
  mockDoctorSlots 
} from '../../mock-data/mock-db';

@Injectable({
  providedIn: 'root'
})
export class ClinicStateService {
  // LocalStorage helper
  private saveRoomsToLocalStorage(rooms: Room[]) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('clinic_rooms', JSON.stringify(rooms));
    }
  }

  private loadInitialRooms(): Room[] {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('clinic_rooms');
      if (stored) {
        try {
          const parsed: Room[] = JSON.parse(stored);
          const cleaned = parsed.map(r => {
            if (r.status === 'Available') {
              return { ...r, doctorId: null };
            }
            return r;
          });
          this.saveRoomsToLocalStorage(cleaned);
          return cleaned;
        } catch {
          // Fallback if parsing fails
        }
      }
      const initial = mockRooms.map(r => r.status === 'Available' ? { ...r, doctorId: null } : { ...r });
      this.saveRoomsToLocalStorage(initial);
      return initial;
    }
    return mockRooms.map(r => r.status === 'Available' ? { ...r, doctorId: null } : { ...r });
  }

  // Global State Signals
  private patientsSig = signal<Patient[]>([]);
  public patients = this.patientsSig.asReadonly();

  private doctorsSig = signal<Doctor[]>([]);
  public doctors = this.doctorsSig.asReadonly();

  // Rooms Signal & Available Rooms Computed Signal
  private roomsSig = signal<Room[]>(this.loadInitialRooms());
  public rooms = this.roomsSig.asReadonly();
  public availableRooms = computed(() => this.roomsSig().filter(r => r.status === 'Available' && r.currentLoad === 0));

  private sessionsSig = signal<Session[]>([]);
  public sessions = this.sessionsSig.asReadonly();

  private waitlistSig = signal<WaitlistItem[]>([]);
  public waitlist = this.waitlistSig.asReadonly();

  private invoicesSig = signal<Invoice[]>([]);
  public invoices = this.invoicesSig.asReadonly();

  // Financial & Revenue Computed Signals
  public todayInvoices = computed(() => {
    const today = new Date();
    const todayYMD = today.toISOString().split('T')[0];
    const pad = (n: number) => n.toString().padStart(2, '0');
    const localYMD = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    return this.invoicesSig().filter(inv => {
      if (!inv.createdAt) return false;
      const invDate = new Date(inv.createdAt);
      const isSameDay = !isNaN(invDate.getTime()) &&
        invDate.getFullYear() === today.getFullYear() &&
        invDate.getMonth() === today.getMonth() &&
        invDate.getDate() === today.getDate();
      const invDatePart = inv.createdAt.split('T')[0];
      return isSameDay || invDatePart === todayYMD || invDatePart === localYMD;
    });
  });

  public expectedTodayRevenue = computed(() =>
    this.todayInvoices().reduce((sum, inv) => sum + (inv.amount || 0), 0)
  );

  public collectedTodayRevenue = computed(() =>
    this.todayInvoices()
      .filter(inv => inv.status === 'Paid')
      .reduce((sum, inv) => sum + (inv.amount || 0), 0)
  );

  public pendingTodayRevenue = computed(() =>
    this.todayInvoices()
      .filter(inv => inv.status === 'Pending' || inv.status === 'Partial')
      .reduce((sum, inv) => sum + (inv.amount || 0), 0)
  );

  public cashCollectedToday = computed(() =>
    this.todayInvoices()
      .filter(inv => inv.status === 'Paid' && inv.paymentMethod === 'Cash')
      .reduce((sum, inv) => sum + (inv.amount || 0), 0)
  );

  public digitalCollectedToday = computed(() =>
    this.todayInvoices()
      .filter(inv => inv.status === 'Paid' && (inv.paymentMethod === 'Credit Card' || inv.paymentMethod === 'E-Wallet'))
      .reduce((sum, inv) => sum + (inv.amount || 0), 0)
  );

  public collectionRateToday = computed(() => {
    const expected = this.expectedTodayRevenue();
    if (expected === 0) return 0;
    return Math.round((this.collectedTodayRevenue() / expected) * 100);
  });

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
    if (this.roomsSig().length === 0) {
      this.roomsSig.set(this.loadInitialRooms());
    }
    this.sessionsSig.set([...mockSessions]);
    this.waitlistSig.set([...mockWaitlist]);
    this.invoicesSig.set([...mockInvoices]);
    this.doctorAvailabilitySig.set([...mockDoctorAvailability]);
    this.doctorSlotsSig.set([...mockDoctorSlots]);
    
    this.isLoading.set(false);
  }

  // ==========================================
  // Interconnected Business Logic
  // ==========================================

  async checkInPatient(sessionId: string) {
    // 1. Find the session
    const sessions = this.sessionsSig();
    const sessionToUpdate = sessions.find(s => s.id === sessionId);
    
    if (!sessionToUpdate) {
      throw new Error('Session not found.');
    }

    // Try to find target room: use session's roomId if available, otherwise find an available room
    let targetRoom = sessionToUpdate.roomId ? this.roomsSig().find(r => r.id === sessionToUpdate.roomId) : undefined;
    if (!targetRoom || targetRoom.status !== 'Available' || targetRoom.currentLoad > 0) {
      const openRooms = this.availableRooms();
      if (openRooms.length === 0) {
        throw new Error('No available rooms found for check-in.');
      }
      targetRoom = openRooms[0];
    }

    this.isLoading.set(true);
    await new Promise(resolve => setTimeout(resolve, 300));

    const assignedRoomId = targetRoom.id;

    // Update Session Status and assign room
    this.sessionsSig.update(list => list.map(s => s.id === sessionId ? { ...s, status: 'In Progress', roomId: assignedRoomId, checkInTime: new Date().toISOString() } : s));

    // 2. Update Room Status (mark Occupied, load 1, and assign doctor from session)
    this.roomsSig.update(list => list.map(r => {
      if (r.id === assignedRoomId) {
        return { ...r, currentLoad: 1, status: 'Occupied', doctorId: sessionToUpdate.doctorId };
      }
      return r;
    }));
    this.saveRoomsToLocalStorage(this.roomsSig());

    // 3. Remove from Waitlist (if applicable)
    this.waitlistSig.update(list => list.filter(w => w.patientId !== sessionToUpdate.patientId));

    this.isLoading.set(false);
  }

  async checkOutPatient(sessionId: string) {
    const invoice = this.invoicesSig().find(inv => inv.sessionId === sessionId);
    if (invoice && invoice.status === 'Pending') {
      throw new Error('Cannot check out: The invoice for this session is pending. Please process payment first.');
    }

    this.isLoading.set(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const sessions = this.sessionsSig();
    const sessionToUpdate = sessions.find(s => s.id === sessionId);
    
    if (sessionToUpdate) {
      this.sessionsSig.update(list => list.map(s => s.id === sessionId ? { ...s, status: 'Completed', checkOutTime: new Date().toISOString() } : s));

      // Reset Room Status to Available, clear doctorId, and reset load to 0
      if (sessionToUpdate.roomId) {
        this.roomsSig.update(list => list.map(r => {
          if (r.id === sessionToUpdate.roomId) {
            return { ...r, currentLoad: 0, status: 'Available', doctorId: null };
          }
          return r;
        }));
        this.saveRoomsToLocalStorage(this.roomsSig());
      }
    }
    
    this.isLoading.set(false);
  }

  markPatientAbsent(sessionId: string): void {
    const sessionToUpdate = this.sessionsSig().find(s => s.id === sessionId);
    if (!sessionToUpdate) {
      throw new Error('Session not found.');
    }

    // 1. Update session status to 'Cancelled'
    this.sessionsSig.update(list =>
      list.map(s => s.id === sessionId ? { ...s, status: 'Cancelled' as SessionStatus } : s)
    );

    // 2. If the session was holding a room (e.g. In Progress or has roomId assigned), release the room
    if (sessionToUpdate.roomId) {
      this.roomsSig.update(rooms =>
        rooms.map(r => {
          if (r.id === sessionToUpdate.roomId) {
            return { ...r, status: 'Available' as const, currentLoad: 0, doctorId: null };
          }
          return r;
        })
      );
      this.saveRoomsToLocalStorage(this.roomsSig());
    }
  }

  /**
   * Absence Policy:
   * When a doctor is absent:
   * 1. The Senior covers 50% (Math.ceil) of that doctor's eligible sessions today (same gender only).
   * 2. The remaining 50% are redistributed among the other available doctors of the same gender (assigned by lowest load).
   * 3. Fallback: ONLY if otherDoctors is empty (no other matching doctors exist), change remaining sessions to 'Cancelled' and release their rooms.
   */
  handleDoctorAbsence(absentDoctorId: string, seniorDoctorId: string): void {
    const absentDoctor = this.doctorsSig().find(d => d.id === absentDoctorId);
    const seniorDoctor = this.doctorsSig().find(d => d.id === seniorDoctorId);

    if (!absentDoctor || !seniorDoctor) {
      throw new Error('Both absent doctor and senior doctor must exist.');
    }

    if (absentDoctor.gender !== seniorDoctor.gender) {
      throw new Error('Senior doctor gender must match the absent doctor to cover sessions.');
    }

    const now = new Date();
    const todayYMD = now.toISOString().split('T')[0];
    const pad = (n: number) => n.toString().padStart(2, '0');
    const localYMD = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    // Filter sessionsSig to find all 'Pending' or 'Confirmed' sessions scheduled for TODAY that belong to absentDoctorId
    const currentSessions = this.sessionsSig();
    const eligibleSessions = currentSessions.filter(s => {
      if (s.doctorId !== absentDoctorId) return false;
      if (s.status !== 'Pending' && s.status !== 'Confirmed') return false;
      if (!s.scheduledAt) return false;
      const datePart = s.scheduledAt.split('T')[0];
      const sessionDate = new Date(s.scheduledAt);
      const isSameDate = !isNaN(sessionDate.getTime()) &&
        sessionDate.getFullYear() === now.getFullYear() &&
        sessionDate.getMonth() === now.getMonth() &&
        sessionDate.getDate() === now.getDate();
      return isSameDate || datePart === todayYMD || datePart === localYMD;
    });

    if (eligibleSessions.length > 0) {
      // Calculate 50% of these sessions (Math.ceil favors covering more if odd)
      const coverCount = Math.ceil(eligibleSessions.length / 2);
      const seniorSessions = eligibleSessions.slice(0, coverCount);
      const remainingSessions = eligibleSessions.slice(coverCount);

      // Find other doctors of the SAME gender, excluding absent doctor and senior doctor
      const otherDoctors = this.doctorsSig().filter(
        d => d.gender === absentDoctor.gender && d.id !== absentDoctorId && d.id !== seniorDoctorId
      );

      // Helper to calculate doctor load
      const getDoctorLoad = (doctorId: string): number => {
        const avail = this.doctorAvailabilitySig().find(a => a.doctorId === doctorId);
        if (avail !== undefined) {
          return avail.currentLoad;
        }
        return this.sessionsSig().filter(s => s.doctorId === doctorId && s.status === 'In Progress').length;
      };

      const reassignments = new Map<string, string>(); // sessionId -> assigned doctorId
      const cancelledIds = new Set<string>();
      const cancelledRoomIds = new Set<string>();

      // 1. Assign first 50% to seniorDoctorId
      seniorSessions.forEach(s => {
        reassignments.set(s.id, seniorDoctorId);
      });

      // 2. For remaining 50%: redistribute to otherDoctors or fallback to Cancelled
      if (otherDoctors.length > 0) {
        // Track running loads for otherDoctors to distribute to lowest load
        const runningLoads = new Map<string, number>();
        otherDoctors.forEach(d => {
          runningLoads.set(d.id, getDoctorLoad(d.id));
        });

        remainingSessions.forEach(session => {
          let lowestDoc = otherDoctors[0];
          let minLoad = runningLoads.get(lowestDoc.id) ?? 0;
          for (const doc of otherDoctors) {
            const load = runningLoads.get(doc.id) ?? 0;
            if (load < minLoad) {
              minLoad = load;
              lowestDoc = doc;
            }
          }
          reassignments.set(session.id, lowestDoc.id);
          runningLoads.set(lowestDoc.id, minLoad + 1);
        });
      } else {
        // Fallback: ONLY if otherDoctors is empty, cancel remaining sessions
        remainingSessions.forEach(session => {
          cancelledIds.add(session.id);
          if (session.roomId) {
            cancelledRoomIds.add(session.roomId);
          }
        });
      }

      // Update sessions in state
      this.sessionsSig.update(list => list.map(s => {
        if (reassignments.has(s.id)) {
          return { ...s, doctorId: reassignments.get(s.id)! };
        }
        if (cancelledIds.has(s.id)) {
          return { ...s, status: 'Cancelled' as SessionStatus };
        }
        return s;
      }));

      // Fallback: release rooms if any sessions were cancelled
      if (cancelledRoomIds.size > 0) {
        this.roomsSig.update(rooms => rooms.map(r => {
          if (cancelledRoomIds.has(r.id)) {
            return { ...r, status: 'Available' as const, currentLoad: 0, doctorId: null };
          }
          return r;
        }));
        this.saveRoomsToLocalStorage(this.roomsSig());
      }
    }
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

  async addSession(sessionData: { patientId: string, doctorId: string, roomId: string, scheduledAt: string, type: SessionType, isFreeAssessment?: boolean, assessmentPrice?: number | null, patientShare?: number, insuranceShare?: number }) {
    const patient = this.patientsSig().find(p => p.id === sessionData.patientId);
    if (patient && patient.paymentType === 'Insurance' && patient.insuranceDetails?.status !== 'Approved') {
      throw new Error('Insurance approval is pending. Cannot book sessions.');
    }

    if (this.isPatientNew(sessionData.patientId) && sessionData.type !== 'Assessment') {
      throw new Error('New patients must complete an Assessment session first.');
    }

    // Strict validation: target room must be Available and currentLoad === 0
    const targetRoom = this.roomsSig().find(r => r.id === sessionData.roomId);
    if (!targetRoom || targetRoom.status !== 'Available' || targetRoom.currentLoad > 0) {
      throw new Error('Room is not available for booking.');
    }

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
      packageAlert: sessionData.type === 'Assessment' ? undefined : 'Session 1 of 1'
    };

    this.sessionsSig.update(sessions => [...sessions, newSession]);
    this.waitlistSig.update(list => list.filter(item => item.patientId !== sessionData.patientId));

    // Auto-generate invoice for this session based on Financial Plan
    let invoiceAmount = 500; // Default fallback
    let invoiceStatus: Invoice['status'] = 'Pending';
    let pShare = sessionData.patientShare;
    let iShare = sessionData.insuranceShare;

    const financialPlan = patient?.financialPlan || patient?.treatmentPlan?.financialPlan;
    if (sessionData.type === 'Assessment') {
      if (sessionData.isFreeAssessment) {
        invoiceAmount = 0;
        invoiceStatus = 'Waived';
        pShare = 0;
        iShare = 0;
      } else if (sessionData.assessmentPrice != null) {
        invoiceAmount = sessionData.assessmentPrice;
      }
    } else if (financialPlan) {
      const plan = financialPlan;
      if (plan.paymentMode === 'Package' || plan.paymentMode === 'Upfront-Copay') {
        // Session is covered by the prepaid package
        invoiceAmount = 0; 
        invoiceStatus = 'Paid'; 
        pShare = 0;
        iShare = 0;
      } else if (plan.paymentMode === 'Per-Session') {
        invoiceAmount = plan.sessionPrice || 500;
      }
    } else if (patient?.paymentType === 'Insurance' && patient.insuranceDetails?.copayPercentage != null) {
      // Legacy fallback
      invoiceAmount = patient.insuranceDetails.copayPercentage;
    }

    const newInvoice: Invoice = {
      id: `INV-${Date.now().toString().slice(-4)}`,
      sessionId: newSession.id,
      patientId: sessionData.patientId,
      amount: invoiceAmount,
      currency: 'EGP',
      status: invoiceStatus,
      type: sessionData.type,
      createdAt: new Date().toISOString(),
      patientShare: pShare !== undefined ? pShare : invoiceAmount,
      insuranceShare: iShare !== undefined ? iShare : 0
    };

    this.invoicesSig.update(invs => [newInvoice, ...invs]);
    this.isLoading.set(false);
  }

  async createTreatmentPlan(planData: {
    patientId: string,
    doctorId: string,
    roomId: string,
    dates: Date[],
    paymentMode: 'Package' | 'Per-Session',
    packagePrice?: number,
    payingNow?: number
  }) {
    this.isLoading.set(true);
    await new Promise(resolve => setTimeout(resolve, 800));

    const newSessions: Session[] = [];
    const newInvoices: Invoice[] = [];

    // Create the sessions and per-session invoices
    planData.dates.forEach((date, i) => {
      const pad = (n: number) => n.toString().padStart(2, '0');
      const scheduledIso = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
      
      const session: Session = {
        id: `SESS-${Date.now().toString().slice(-4)}-${i}`,
        patientId: planData.patientId,
        doctorId: planData.doctorId,
        roomId: planData.roomId,
        scheduledAt: scheduledIso,
        type: 'Session',
        status: 'Confirmed',
        packageAlert: `Session ${i + 1} of ${planData.dates.length}`
      };
      newSessions.push(session);

      const invoice: Invoice = {
        id: `INV-${Date.now().toString().slice(-4)}-${i}`,
        sessionId: session.id,
        patientId: planData.patientId,
        amount: planData.paymentMode === 'Package' ? 0 : (planData.packagePrice || 500), // Default fallback for per-session
        currency: 'EGP',
        status: planData.paymentMode === 'Package' ? 'Paid' : 'Pending',
        type: 'Session',
        createdAt: new Date().toISOString(),
        patientShare: planData.paymentMode === 'Package' ? 0 : (planData.packagePrice || 500),
        insuranceShare: 0
      };
      newInvoices.push(invoice);
    });

    this.sessionsSig.update(s => [...s, ...newSessions]);
    this.waitlistSig.update(list => list.filter(item => item.patientId !== planData.patientId));
    
    // Update Patient's Financial Plan
    this.patientsSig.update(list => list.map(p => {
      if (p.id !== planData.patientId) return p;
      const plan = p.financialPlan ?? p.treatmentPlan?.financialPlan;
      const remainingDebt = planData.paymentMode === 'Package' 
        ? Math.max(0, (planData.packagePrice || 0) - (planData.payingNow || 0))
        : 0;

      const updatedPlan = {
        paymentMode: planData.paymentMode,
        totalAgreedAmount: planData.packagePrice,
        totalPaidSoFar: planData.payingNow || 0,
        remainingDebt: remainingDebt,
        sessionPrice: planData.paymentMode === 'Per-Session' ? planData.packagePrice : undefined
      };

      return {
        ...p,
        financialPlan: updatedPlan,
        treatmentPlan: {
          totalSessions: planData.dates.length,
          primaryDoctorId: planData.doctorId,
          financialPlan: updatedPlan
        }
      };
    }));

    // If package and there is an initial payment, create installment invoice
    if (planData.paymentMode === 'Package' && planData.payingNow && planData.payingNow > 0) {
      const installmentInvoice: Invoice = {
        id: `INV-INST-${Date.now().toString().slice(-6)}`,
        patientId: planData.patientId,
        amount: planData.payingNow,
        currency: 'EGP',
        status: 'Paid',
        type: 'Installment',
        createdAt: new Date().toISOString(),
        paidAmount: planData.payingNow,
        remainingBalance: 0,
        paymentMethod: 'Cash', // Defaulting to Cash for now
        isInstallment: true,
        patientShare: planData.payingNow,
        insuranceShare: 0
      };
      newInvoices.unshift(installmentInvoice);
    }

    this.invoicesSig.update(invs => [...newInvoices, ...invs]);
    this.isLoading.set(false);
  }

  async bookSession(sessionData: { patientId: string, doctorId: string, roomId: string, scheduledAt: string, type: SessionType, isFreeAssessment?: boolean, assessmentPrice?: number | null, patientShare?: number, insuranceShare?: number }) {
    const patient = this.patientsSig().find(p => p.id === sessionData.patientId);
    if (patient && patient.paymentType === 'Insurance' && patient.insuranceDetails?.status !== 'Approved') {
      throw new Error('Insurance approval is pending. Cannot book sessions.');
    }
    return this.addSession(sessionData);
  }

  isPatientNew(patientId: string): boolean {
    if (!patientId) return true;
    const patientSessions = this.sessionsSig().filter(s => s.patientId === patientId);
    if (patientSessions.length === 0) return true;

    const hasCompletedAssessment = patientSessions.some(
      s => s.type === 'Assessment' && s.status === 'Completed'
    );
    return !hasCompletedAssessment;
  }

  findNearestSlot(patientId: string, candidateDoctors?: Doctor[]): { doctorId: string; roomId: string; scheduledAt: string } {
    if (!patientId) {
      throw new Error('Please select a patient first.');
    }

    const patient = this.patientsSig().find(p => p.id === patientId);
    if (patient && patient.paymentType === 'Insurance' && patient.insuranceDetails?.status !== 'Approved') {
      throw new Error('Insurance approval is pending. Cannot book sessions.');
    }

    // a) Get patient's gender
    const patientGender = this.getPatientGender(patientId);
    if (!patientGender) {
      throw new Error('Patient not found.');
    }

    // Helper: calculate doctor's current load
    const getDoctorLoad = (doctorId: string): number => {
      const avail = this.doctorAvailabilitySig().find(a => a.doctorId === doctorId);
      if (avail !== undefined) {
        return avail.currentLoad;
      }
      return this.sessionsSig().filter(s => s.doctorId === doctorId && s.status === 'In Progress').length;
    };

    // b) Find available doctor matching that gender who currently has currentLoad < 2
    // If candidateDoctors is provided, search strictly within candidates
    const sourceDoctors = candidateDoctors !== undefined ? candidateDoctors : this.doctorsSig();
    const doctorsOfGender = sourceDoctors.filter(d => d.gender === patientGender);
    if (doctorsOfGender.length === 0) {
      throw new Error(`No available ${patientGender.toLowerCase()} doctor found to treat this patient.`);
    }

    const matchingDoctors = doctorsOfGender.filter(d => getDoctorLoad(d.id) < 2);
    if (matchingDoctors.length === 0) {
      throw new Error(`No available ${patientGender.toLowerCase()} doctor found with current load under 2.`);
    }

    // Pick doctor with the lowest current load
    matchingDoctors.sort((a, b) => getDoctorLoad(a.id) - getDoctorLoad(b.id));
    const selectedDoctor = matchingDoctors[0];

    // c) Auto-select an available room from availableRooms()
    const openRooms = this.availableRooms();
    if (openRooms.length === 0) {
      throw new Error('No available rooms found for booking.');
    }
    const selectedRoom = openRooms[0];

    // d) Default scheduledAt time: rounded to next nearest 30 mins
    const now = new Date();
    const intervalMs = 30 * 60 * 1000;
    const roundedTime = new Date(Math.ceil(now.getTime() / intervalMs) * intervalMs);

    const pad = (n: number) => n.toString().padStart(2, '0');
    const localIso = `${roundedTime.getFullYear()}-${pad(roundedTime.getMonth() + 1)}-${pad(roundedTime.getDate())}T${pad(roundedTime.getHours())}:${pad(roundedTime.getMinutes())}:00`;

    return {
      doctorId: selectedDoctor.id,
      roomId: selectedRoom.id,
      scheduledAt: localIso
    };
  }

  // ==========================================
  // Room Logic
  // ==========================================

  async addNewRoom(roomData: Partial<Room> & { displayName: string } | Room) {
    this.isLoading.set(true);
    await new Promise(resolve => setTimeout(resolve, 300));

    const newRoom: Room = {
      id: ('id' in roomData && roomData.id) ? roomData.id : `room_${Date.now()}`,
      displayName: roomData.displayName,
      status: roomData.status || 'Available',
      doctorId: roomData.status === 'Occupied' ? (roomData.doctorId ?? null) : null,
      currentLoad: roomData.currentLoad ?? 0,
      capacity: roomData.capacity ?? 1
    };

    this.roomsSig.update(rooms => [...rooms, newRoom]);
    this.saveRoomsToLocalStorage(this.roomsSig());
    this.isLoading.set(false);
    return newRoom;
  }

  async reassignRoom(roomId: string, doctorId: string | null) {
    this.isLoading.set(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    this.roomsSig.update(rooms => rooms.map(r => {
      if (r.id === roomId) {
        return { ...r, doctorId: doctorId };
      }
      return r;
    }));
    this.saveRoomsToLocalStorage(this.roomsSig());
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
          return { ...r, status: 'Available', currentLoad: 0, doctorId: null };
        } else if (status === 'Occupied') {
          return { ...r, status: 'Occupied', currentLoad: 1 };
        }
      }
      return r;
    }));
    this.saveRoomsToLocalStorage(this.roomsSig());
    this.isLoading.set(false);
  }

  async toggleRoomMaintenance(roomId: string) {
    this.isLoading.set(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    
    this.roomsSig.update(rooms => rooms.map(r => {
      if (r.id === roomId) {
        if (r.status === 'Maintenance') {
          return { ...r, status: 'Available', currentLoad: 0, doctorId: null };
        } else {
          return { ...r, status: 'Maintenance', doctorId: null, currentLoad: 0 };
        }
      }
      return r;
    }));
    this.saveRoomsToLocalStorage(this.roomsSig());
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
      address: newPatient.address,
      occupation: newPatient.occupation,
      paymentType: newPatient.paymentType as 'Cash' | 'Online' | 'Insurance',
      lastVisit: new Date().toISOString(),
      documents: { ...newPatient.docs },
      insuranceDetails: newPatient.paymentType === 'Insurance' ? newPatient.insuranceDetails : undefined,
      financialPlan: newPatient.financialPlan
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
  // Billing Logic
  // ==========================================

  /**
   * Processes a manual payment against an invoice.
   * Supports partial payments: accumulates paidAmount, sets status to
   * 'Partial' when remainingBalance > 0, 'Paid' when fully settled.
   * Also syncs the patient's financial plan totalPaidSoFar / remainingDebt.
   */
  async processPayment(invoiceId: string, amountCollected: number, method: string): Promise<void> {
    this.isProcessingPayment.set(true);
    await new Promise(resolve => setTimeout(resolve, 800));

    let linkedPatientId: string | null = null;

    this.invoicesSig.update(invoices => invoices.map(inv => {
      if (inv.id !== invoiceId) return inv;

      linkedPatientId = inv.patientId;

      const previouslyPaid = inv.paidAmount ?? 0;
      const newPaidAmount   = previouslyPaid + amountCollected;
      const invoiceTotal    = inv.netAmount ?? inv.amount;
      const newRemaining    = Math.max(0, invoiceTotal - newPaidAmount);
      const newStatus       = newRemaining <= 0 ? 'Paid' : 'Partial';

      return {
        ...inv,
        paidAmount:       newPaidAmount,
        remainingBalance: newRemaining,
        status:           newStatus as import('../../models/invoice.model').InvoiceStatus,
        paymentMethod:    method
      };
    }));

    // Sync patient financial plan if the invoice is linked to a patient
    if (linkedPatientId) {
      this.patientsSig.update(list => list.map(p => {
        if (p.id !== linkedPatientId) return p;
        const plan = p.financialPlan ?? p.treatmentPlan?.financialPlan;
        if (!plan) return p;
        const updatedPlan = {
          ...plan,
          totalPaidSoFar: (plan.totalPaidSoFar ?? 0) + amountCollected,
          remainingDebt:  Math.max(0, (plan.remainingDebt ?? 0) - amountCollected)
        };
        return p.financialPlan
          ? { ...p, financialPlan: updatedPlan }
          : { ...p, treatmentPlan: { ...p.treatmentPlan!, financialPlan: updatedPlan } };
      }));
    }

    this.isProcessingPayment.set(false);
  }

  /**
   * Collects a partial or full installment payment against a patient's financial plan
   * (Package or Upfront-Copay). Updates totalPaidSoFar / remainingDebt on the plan
   * and creates an Installment receipt invoice in the ledger.
   */
  async collectInstallment(patientId: string, amount: number, paymentMethod: string, sessionId?: string): Promise<void> {
    if (amount <= 0) return;

    this.isProcessingPayment.set(true);
    await new Promise(resolve => setTimeout(resolve, 500));

    // Create the Installment invoice
    const installmentInvoice: Invoice = {
      id: `INV-INST-${Date.now().toString().slice(-6)}`,
      sessionId: sessionId || 'installment',
      patientId: patientId,
      amount: amount,
      currency: 'EGP',
      status: 'Paid',
      type: 'Installment',
      createdAt: new Date().toISOString(),
      paidAmount: amount,
      remainingBalance: 0,
      paymentMethod: paymentMethod
    };

    // Add to invoices state
    this.invoicesSig.update(invs => [installmentInvoice, ...invs]);

    // Update patient's financial plan debt
    this.patientsSig.update(list => list.map(p => {
      if (p.id !== patientId) return p;
      const plan = p.financialPlan ?? p.treatmentPlan?.financialPlan;
      if (!plan) return p;
      const updatedPlan = {
        ...plan,
        totalPaidSoFar: (plan.totalPaidSoFar ?? 0) + amount,
        remainingDebt:  Math.max(0, (plan.remainingDebt ?? 0) - amount)
      };
      return p.financialPlan
        ? { ...p, financialPlan: updatedPlan }
        : { ...p, treatmentPlan: { ...p.treatmentPlan!, financialPlan: updatedPlan } };
    }));

    this.isProcessingPayment.set(false);
  }

  // ==========================================
  // UI Helper Methods (ID to Name Resolution)
  // ==========================================

  getPatientName(id?: string | null): string {
    if (!id) return 'Unknown Patient';
    const p = this.patientsSig().find(x => x.id === id);
    return p ? p.nameEn : 'Unknown Patient';
  }

  getPatientGender(id?: string | null): 'Male' | 'Female' | '' {
    if (!id) return '';
    const p = this.patientsSig().find(x => x.id === id);
    return p ? p.gender : '';
  }

  getPatientAvatar(id?: string | null): string {
    if (!id) return '';
    const p = this.patientsSig().find(x => x.id === id);
    return p ? p.avatar : '';
  }

  getPatientPhone(id?: string | null): string {
    if (!id) return '';
    const p = this.patientsSig().find(x => x.id === id);
    return p ? p.phone : '';
  }

  getDoctorName(id?: string | null): string {
    if (!id) return 'Unassigned';
    const d = this.doctorsSig().find(x => x.id === id);
    return d ? d.name : 'Unassigned';
  }

  getDoctorGender(id?: string | null): string {
    if (!id) return '';
    const d = this.doctorsSig().find(x => x.id === id);
    return d ? d.gender : '';
  }

  getRoomName(id?: string | null): string {
    if (!id) return 'No Room';
    const r = this.roomsSig().find(x => x.id === id);
    return r ? r.displayName : 'No Room';
  }

  getRoomCapacity(id?: string | null): number {
    if (!id) return 0;
    const r = this.roomsSig().find(x => x.id === id);
    return r ? r.capacity : 0;
  }

  getSessionBadge(session: Session): string {
    if (!session) return '';
    const patient = this.patientsSig().find(p => p.id === session.patientId);
    if (!patient) return session.packageAlert || '';

    const total = patient.treatmentPlan?.totalSessions || patient.insuranceDetails?.approvedSessions;
    if (!total) return session.packageAlert || '';

    // If session has an explicit sessionNumber, use it. Otherwise, find its index among patient sessions.
    let sessionNum = session.sessionNumber;
    if (!sessionNum) {
      const patientSessions = this.sessionsSig()
        .filter(s => s.patientId === session.patientId)
        .sort((a, b) => {
          const timeA = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
          const timeB = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
          return timeA - timeB;
        });
      const index = patientSessions.findIndex(s => s.id === session.id);
      sessionNum = index !== -1 ? index + 1 : 1;
    }

    return `Session ${sessionNum} of ${total}`;
  }

  getPatientProgressBadge(patientId: string, sessionId: string): string {
    const session = this.sessionsSig().find(s => s.id === sessionId);
    if (session) {
      return this.getSessionBadge(session);
    }
    const patient = this.patientsSig().find(p => p.id === patientId);
    if (patient?.treatmentPlan?.totalSessions) {
      return `Session 1 of ${patient.treatmentPlan.totalSessions}`;
    }
    return '';
  }

  getPatientById(id: string | null): Patient | undefined {
    if (!id) return undefined;
    return this.patientsSig().find(p => p.id === id);
  }

  getSessionsByPatientId(patientId: string): Session[] {
    return this.sessionsSig()
      .filter(s => s.patientId === patientId)
      .sort((a, b) => (a.sessionNumber || 0) - (b.sessionNumber || 0));
  }

  getSessionInvoice(sessionId: string): Invoice | undefined {
    return this.invoicesSig().find(inv => inv.sessionId === sessionId);
  }



  /** Look up a single invoice by ID */
  getInvoiceById(id: string | null): Invoice | undefined {
    if (!id) return undefined;
    return this.invoicesSig().find(inv => inv.id === id);
  }
}
