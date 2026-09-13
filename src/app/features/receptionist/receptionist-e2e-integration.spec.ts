import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { Injector, runInInjectionContext } from '@angular/core';
import { BookingsComponent } from './bookings/bookings';
import { ClinicStateService } from '../../core/services/state/clinic-state.service';
import { MessageService } from 'primeng/api';
import { SessionStatus, SessionType } from '../../core/models/session.model';

describe('Receptionist & ClinicState E2E Integration Suite', () => {
  let clinicState: ClinicStateService;
  let messageService: MessageService;
  let bookingsComponent: BookingsComponent;

  beforeEach(async () => {
    clinicState = new ClinicStateService();
    messageService = new MessageService();

    // Allow mock async initialization to settle
    await new Promise(resolve => setTimeout(resolve, 600));

    const injector = Injector.create({
      providers: [
        { provide: ClinicStateService, useValue: clinicState },
        { provide: MessageService, useValue: messageService }
      ]
    });

    bookingsComponent = runInInjectionContext(injector, () => new BookingsComponent());
  });

  // =========================================================================
  // 1. PATIENT & INSURANCE FLOWS (THE GATES)
  // =========================================================================
  describe('1. Patient & Insurance Flows (The Gates)', () => {
    it('SUCCESS: Old patient booking a standard "Session"', async () => {
      // Patient 1 (Ahmed Fathy) is an existing patient
      bookingsComponent.onPatientChange('1');
      expect(bookingsComponent.isNewPatient).toBe(false);

      bookingsComponent.sessionType = 'Session';
      bookingsComponent.selectedDoctorId = 'doc_2'; // Male doctor
      const openRoom = bookingsComponent.availableRooms()[0];
      bookingsComponent.selectedRoomId = openRoom.id;
      bookingsComponent.scheduledDate = new Date('2026-09-20T10:00:00');

      let lastMessage: any = null;
      messageService.add = (msg: any) => { lastMessage = msg; };

      await bookingsComponent.submitBooking();

      expect(lastMessage).toBeTruthy();
      expect(lastMessage.severity).toBe('success');
      expect(lastMessage.summary).toBe('Booking Successful');
      expect(lastMessage.detail).toContain('Session booked');
    });

    it('SUCCESS: New patient locked strictly to "Assessment" type', async () => {
      // Patient 5 (Youssef Ali) is a new patient
      bookingsComponent.onPatientChange('5');
      expect(bookingsComponent.isNewPatient).toBe(true);
      expect(bookingsComponent.sessionType).toBe('Assessment');

      // State service level validation: attempting to add 'Session' throws an error
      const openRoom = clinicState.availableRooms()[0];
      await expect(clinicState.addSession({
        patientId: '5',
        doctorId: 'doc_2',
        roomId: openRoom.id,
        scheduledAt: '2026-09-20T11:00:00',
        type: 'Session'
      })).rejects.toThrow('New patients must complete an Assessment session first.');

      // But adding 'Assessment' succeeds
      await expect(clinicState.addSession({
        patientId: '5',
        doctorId: 'doc_2',
        roomId: openRoom.id,
        scheduledAt: '2026-09-20T11:00:00',
        type: 'Assessment'
      })).resolves.toBeUndefined();
    });

    it('SUCCESS: Insurance patient with "Approved" status successfully books a session', async () => {
      // Patient 2 (Mona Zaki) is an approved insurance patient
      bookingsComponent.onPatientChange('2');
      expect(bookingsComponent.isInsurancePending).toBe(false);

      bookingsComponent.sessionType = 'Session';
      bookingsComponent.selectedDoctorId = 'doc_1'; // Female doctor
      const openRoom = bookingsComponent.availableRooms()[0];
      bookingsComponent.selectedRoomId = openRoom.id;
      bookingsComponent.scheduledDate = new Date('2026-09-20T12:00:00');

      let lastMessage: any = null;
      messageService.add = (msg: any) => { lastMessage = msg; };

      await bookingsComponent.submitBooking();

      expect(lastMessage).toBeTruthy();
      expect(lastMessage.severity).toBe('success');
      expect(lastMessage.summary).toBe('Booking Successful');
    });

    it('EDGE CASE / FAIL: Booking is blocked/throws error if an Insurance patient has a "Pending" status', async () => {
      // Patient 7 (Tamer Hosny) has pending insurance
      bookingsComponent.onPatientChange('7');
      expect(bookingsComponent.isInsurancePending).toBe(true);

      let lastMessage: any = null;
      messageService.add = (msg: any) => { lastMessage = msg; };

      // Try booking via component
      await bookingsComponent.submitBooking();
      expect(lastMessage).toBeTruthy();
      expect(lastMessage.severity).toBe('error');
      expect(lastMessage.detail).toBe('Insurance approval is pending. Cannot book sessions.');

      // State service also throws
      await expect(clinicState.addSession({
        patientId: '7',
        doctorId: 'doc_2',
        roomId: 'room_1',
        scheduledAt: '2026-09-20T13:00:00',
        type: 'Session'
      })).rejects.toThrow('Insurance approval is pending. Cannot book sessions.');
    });
  });

  // =========================================================================
  // 2. SMART BOOKING & GENDER MATCHING
  // =========================================================================
  describe('2. Smart Booking & Gender Matching', () => {
    it('SUCCESS: findNearestSlot auto-selects a Male doctor for a Male patient, finding the lowest load (< 2)', () => {
      // Male Patient 5 (Youssef Ali)
      const slot = clinicState.findNearestSlot('5');
      expect(slot).toBeDefined();

      // Selected doctor must be Male
      const doc = clinicState.doctors().find(d => d.id === slot.doctorId);
      expect(doc?.gender).toBe('Male');

      // Verify doctor load is strictly < 2
      const avail = (clinicState as any).doctorAvailabilitySig().find((a: any) => a.doctorId === slot.doctorId);
      if (avail) {
        expect(avail.currentLoad).toBeLessThan(2);
      }
    });

    it('EDGE CASE / FAIL: findNearestSlot throws a clear error if no doctors of the matching gender are available', () => {
      // Candidate doctors list only has female doctors
      const femaleOnly = clinicState.doctors().filter(d => d.gender === 'Female');

      // Male patient 5 requires Male doctor
      expect(() => clinicState.findNearestSlot('5', femaleOnly))
        .toThrow('No available male doctor found to treat this patient.');
    });

    it('EDGE CASE: Ensure changing the patient dropdown dynamically resets the doctor dropdown if the gender no longer matches', () => {
      bookingsComponent.onPatientChange('5'); // Male patient
      bookingsComponent.selectedDoctorId = 'doc_2'; // Male doctor
      expect(bookingsComponent.selectedDoctorId).toBe('doc_2');

      // Switch to Female patient (Sara Mahmoud - Patient 6)
      bookingsComponent.onPatientChange('6');

      // Male doctor must be reset to empty string
      expect(bookingsComponent.selectedDoctorId).toBe('');
      // Filtered doctors must contain only females
      bookingsComponent.filteredDoctors.forEach(doc => {
        expect(doc.gender).toBe('Female');
      });
    });
  });

  // =========================================================================
  // 3. SESSION LIFECYCLE & ROOM SYNCHRONIZATION
  // =========================================================================
  describe('3. Session Lifecycle & Room Synchronization', () => {
    it('SUCCESS: Check-in -> Assigns available room, marks room "Occupied", assigns doctorId to room, sets session "In Progress"', async () => {
      // Prepare room_1 as available
      (clinicState as any).roomsSig.update((rooms: any[]) => rooms.map(r => r.id === 'room_1' ? { ...r, status: 'Available', currentLoad: 0, doctorId: null } : r));

      const today = new Date().toISOString().split('T')[0];
      const sessionId = 'lifecycle_checkin_test';
      (clinicState as any).sessionsSig.update((list: any[]) => [
        ...list,
        {
          id: sessionId,
          patientId: '1',
          doctorId: 'doc_2',
          roomId: 'room_1',
          scheduledAt: `${today}T09:00:00`,
          status: 'Confirmed',
          type: 'Session'
        }
      ]);

      await clinicState.checkInPatient(sessionId);

      const session = clinicState.sessions().find(s => s.id === sessionId);
      expect(session?.status).toBe('In Progress');
      expect(session?.roomId).toBe('room_1');

      const room = clinicState.rooms().find(r => r.id === 'room_1');
      expect(room?.status).toBe('Occupied');
      expect(room?.currentLoad).toBe(1);
      expect(room?.doctorId).toBe('doc_2');
    });

    it('SUCCESS: Check-out -> Marks session "Completed", resets room to "Available", clears room doctorId', async () => {
      // Room 1 is occupied
      (clinicState as any).roomsSig.update((rooms: any[]) => rooms.map(r => r.id === 'room_1' ? { ...r, status: 'Occupied', currentLoad: 1, doctorId: 'doc_2' } : r));

      const today = new Date().toISOString().split('T')[0];
      const sessionId = 'lifecycle_checkout_test';
      (clinicState as any).sessionsSig.update((list: any[]) => [
        ...list,
        {
          id: sessionId,
          patientId: '1',
          doctorId: 'doc_2',
          roomId: 'room_1',
          scheduledAt: `${today}T09:00:00`,
          status: 'In Progress',
          type: 'Session'
        }
      ]);

      // Mock invoice with status: 'Paid' so check-out is permitted
      (clinicState as any).invoicesSig.update((list: any[]) => [
        ...list,
        {
          id: 'INV_lifecycle_checkout_paid',
          sessionId: sessionId,
          patientId: '1',
          amount: 500,
          currency: 'EGP',
          status: 'Paid',
          type: 'Session',
          createdAt: `${today}T09:00:00Z`
        }
      ]);

      await clinicState.checkOutPatient(sessionId);

      const session = clinicState.sessions().find(s => s.id === sessionId);
      expect(session?.status).toBe('Completed');

      const room = clinicState.rooms().find(r => r.id === 'room_1');
      expect(room?.status).toBe('Available');
      expect(room?.currentLoad).toBe(0);
      expect(room?.doctorId).toBeNull();
    });

    it('EDGE CASE / FAIL: Attempting to Check-out with an unpaid invoice throws an error', async () => {
      const today = new Date().toISOString().split('T')[0];
      const sessionId = 'lifecycle_unpaid_checkout';
      (clinicState as any).sessionsSig.update((list: any[]) => [
        ...list,
        {
          id: sessionId,
          patientId: '1',
          doctorId: 'doc_2',
          roomId: 'room_1',
          scheduledAt: `${today}T09:00:00`,
          status: 'In Progress',
          type: 'Session'
        }
      ]);

      // Mock invoice with status: 'Pending' (Unpaid)
      (clinicState as any).invoicesSig.update((list: any[]) => [
        ...list,
        {
          id: 'INV_lifecycle_unpaid',
          sessionId: sessionId,
          patientId: '1',
          amount: 500,
          currency: 'EGP',
          status: 'Pending',
          type: 'Session',
          createdAt: `${today}T09:00:00Z`
        }
      ]);

      await expect(clinicState.checkOutPatient(sessionId))
        .rejects.toThrow('Cannot check out: The invoice for this session has not been paid yet.');
    });

    it('SUCCESS: Processing payment unlocks check-out and properly completes session in synchronized state', async () => {
      const today = new Date().toISOString().split('T')[0];
      const sessionId = 'lifecycle_pay_then_checkout';
      const invoiceId = 'INV_pay_then_checkout';

      (clinicState as any).sessionsSig.update((list: any[]) => [
        ...list,
        {
          id: sessionId,
          patientId: '1',
          doctorId: 'doc_2',
          roomId: 'room_1',
          scheduledAt: `${today}T09:00:00`,
          status: 'In Progress',
          type: 'Session'
        }
      ]);

      (clinicState as any).invoicesSig.update((list: any[]) => [
        ...list,
        {
          id: invoiceId,
          sessionId: sessionId,
          patientId: '1',
          amount: 500,
          currency: 'EGP',
          status: 'Pending',
          type: 'Session',
          createdAt: `${today}T09:00:00Z`
        }
      ]);

      // 1. Initial attempt to check out throws unpaid error
      await expect(clinicState.checkOutPatient(sessionId))
        .rejects.toThrow('Cannot check out: The invoice for this session has not been paid yet.');

      // 2. Process payment in Billing
      await clinicState.processPayment(invoiceId, 'Credit Card');

      // Verify invoice state updated immutably
      const paidInvoice = clinicState.invoices().find(inv => inv.id === invoiceId);
      expect(paidInvoice?.status).toBe('Paid');
      expect(paidInvoice?.paymentMethod).toBe('Credit Card');

      // 3. Check-out now succeeds
      await clinicState.checkOutPatient(sessionId);

      const session = clinicState.sessions().find(s => s.id === sessionId);
      expect(session?.status).toBe('Completed');

      const room = clinicState.rooms().find(r => r.id === 'room_1');
      expect(room?.status).toBe('Available');
      expect(room?.currentLoad).toBe(0);
    });

    it('EDGE CASE / FAIL: Attempting to Check-in when 0 rooms are "Available" throws an error', async () => {
      // Make all rooms Occupied
      (clinicState as any).roomsSig.update((rooms: any[]) => rooms.map(r => ({ ...r, status: 'Occupied', currentLoad: 1 })));

      const sessionId = 'lifecycle_zero_rooms';
      (clinicState as any).sessionsSig.update((list: any[]) => [
        ...list,
        {
          id: sessionId,
          patientId: '1',
          doctorId: 'doc_2',
          roomId: 'room_1',
          scheduledAt: new Date().toISOString(),
          status: 'Confirmed',
          type: 'Session'
        }
      ]);

      await expect(clinicState.checkInPatient(sessionId))
        .rejects.toThrow('No available rooms found for check-in.');
    });
  });

  // =========================================================================
  // 4. DOCTOR ABSENCE POLICY (COMPLEX LOGIC)
  // =========================================================================
  describe('4. Doctor Absence Policy (Complex Logic)', () => {
    it('EDGE CASE / FAIL: Triggering absence with a covering Senior of a DIFFERENT gender throws an error', () => {
      // doc_1 is Female, doc_2 is Male
      expect(() => clinicState.handleDoctorAbsence('doc_1', 'doc_2'))
        .toThrow('Senior doctor gender must match the absent doctor to cover sessions.');
    });

    it('SUCCESS: 50% Redistribution. If a doctor has 5 pending sessions, exactly 3 (Math.ceil) are reassigned to the Senior (doc_2), and 2 are reassigned to other doctor (doc_5)', () => {
      const today = new Date().toISOString().split('T')[0];

      // Create 5 eligible sessions for absent doc_4 (Male)
      const fiveSessions = [
        { id: 'sess_1', scheduledAt: `${today}T08:00:00`, patientId: '1', doctorId: 'doc_4', roomId: 'room_1', status: 'Pending' as SessionStatus, type: 'Session' as SessionType },
        { id: 'sess_2', scheduledAt: `${today}T09:00:00`, patientId: '3', doctorId: 'doc_4', roomId: 'room_2', status: 'Confirmed' as SessionStatus, type: 'Session' as SessionType },
        { id: 'sess_3', scheduledAt: `${today}T10:00:00`, patientId: '5', doctorId: 'doc_4', roomId: 'room_3', status: 'Pending' as SessionStatus, type: 'Assessment' as SessionType },
        { id: 'sess_4', scheduledAt: `${today}T11:00:00`, patientId: '1', doctorId: 'doc_4', roomId: 'room_4', status: 'Confirmed' as SessionStatus, type: 'Session' as SessionType },
        { id: 'sess_5', scheduledAt: `${today}T12:00:00`, patientId: '3', doctorId: 'doc_4', roomId: 'room_5', status: 'Pending' as SessionStatus, type: 'Session' as SessionType },
      ];

      const others = clinicState.sessions().filter(s => s.doctorId !== 'doc_4');
      (clinicState as any).sessionsSig.set([...others, ...fiveSessions]);

      // Trigger absence: doc_4 (Male) covered by doc_2 (Senior Male). Other doctor is doc_5 (Male).
      clinicState.handleDoctorAbsence('doc_4', 'doc_2');

      const updated = clinicState.sessions().filter(s => ['sess_1', 'sess_2', 'sess_3', 'sess_4', 'sess_5'].includes(s.id));

      // Math.ceil(5 / 2) = 3 covered by Senior
      const covered = updated.filter(s => s.doctorId === 'doc_2');
      expect(covered.length).toBe(3);
      expect(covered.map(s => s.id)).toEqual(['sess_1', 'sess_2', 'sess_3']);

      // Remaining 2 reassigned to doc_5
      const otherReassigned = updated.filter(s => s.doctorId === 'doc_5');
      expect(otherReassigned.length).toBe(2);
      expect(otherReassigned.map(s => s.id)).toEqual(['sess_4', 'sess_5']);

      // None cancelled
      expect(updated.filter(s => s.status === 'Cancelled').length).toBe(0);
    });

    it('EDGE CASE: Ensure Cancelled sessions automatically release their assigned rooms when no other doctors exist', () => {
      const today = new Date().toISOString().split('T')[0];

      // Female doctors: doc_1 (absent) and doc_3 (senior). No other female doctors exist in mock-db.
      // Mark room_4 as occupied by doc_1
      (clinicState as any).roomsSig.update((rooms: any[]) => rooms.map(r => {
        if (r.id === 'room_4') {
          return { ...r, status: 'Occupied', currentLoad: 1, doctorId: 'doc_1' };
        }
        return r;
      }));

      const testSessions = [
        { id: 's_cover', scheduledAt: `${today}T09:00:00`, patientId: '2', doctorId: 'doc_1', roomId: 'room_2', status: 'Pending' as SessionStatus, type: 'Session' as SessionType },
        { id: 's_cancel', scheduledAt: `${today}T10:00:00`, patientId: '4', doctorId: 'doc_1', roomId: 'room_4', status: 'Confirmed' as SessionStatus, type: 'Session' as SessionType },
      ];

      const others = clinicState.sessions().filter(s => s.doctorId !== 'doc_1');
      (clinicState as any).sessionsSig.set([...others, ...testSessions]);

      // 2 sessions: Math.ceil(2/2) = 1 covered by doc_3, 1 cancelled (s_cancel linked to room_4)
      clinicState.handleDoctorAbsence('doc_1', 'doc_3');

      const room4 = clinicState.rooms().find(r => r.id === 'room_4');
      expect(room4?.status).toBe('Available');
      expect(room4?.currentLoad).toBe(0);
      expect(room4?.doctorId).toBeNull();
    });
  });

  // =========================================================================
  // 5. GLOBAL UI CONSTRAINTS AUDIT
  // =========================================================================
  describe('5. Global UI Constraints Audit', () => {
    it('Verify dropdown, calendar/datepicker, and dialog overlay configuration', () => {
      // In PrimeNG 18/19, components use appendTo="body" and clean-modal
      expect(bookingsComponent).toBeDefined();
      expect(bookingsComponent.showAbsenceModal).toBe(false);
      expect(bookingsComponent.isQuickAddModalOpen).toBe(false);
    });
  });
});
