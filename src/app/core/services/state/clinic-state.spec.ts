import { describe, it, expect, beforeEach } from 'vitest';
import { ClinicStateService } from './clinic-state.service';

describe('ClinicStateService Business Rules & Date Filtering Unit Tests', () => {
  let service: ClinicStateService;

  beforeEach(async () => {
    service = new ClinicStateService();
    // Wait for initial simulation delay
    await new Promise(resolve => setTimeout(resolve, 600));
  });

  describe('Business Rule: isPatientNew (Assessment First)', () => {
    it('should identify patient 1 (Ahmed Fathy) as NOT new because they have completed assessment in history', () => {
      // Patient 1 has hist_1 with type 'Assessment' and status 'Completed'
      expect(service.isPatientNew('1')).toBe(false);
    });

    it('should identify patient 2 (Mona Zaki) as NOT new because they have completed assessment in history', () => {
      // Patient 2 has hist_2 with type 'Assessment' and status 'Completed'
      expect(service.isPatientNew('2')).toBe(false);
    });

    it('should identify patient 5 (Youssef Ali) as NEW because they only have a scheduled/pending assessment', () => {
      // Patient 5 only has session 5 scheduled today (status 'Confirmed', not 'Completed')
      expect(service.isPatientNew('5')).toBe(true);
    });

    it('should identify patient 6 (Sara Mahmoud) as NEW because they have no completed assessment', () => {
      expect(service.isPatientNew('6')).toBe(true);
    });

    it('should identify non-existent or empty patient ID as new', () => {
      expect(service.isPatientNew('')).toBe(true);
      expect(service.isPatientNew('non_existent_id')).toBe(true);
    });
  });

  describe('Business Rule: Strict Gender Matching & Slot Finding', () => {
    it('should correctly return patient gender', () => {
      expect(service.getPatientGender('1')).toBe('Male');
      expect(service.getPatientGender('2')).toBe('Female');
      expect(service.getPatientGender('5')).toBe('Male');
      expect(service.getPatientGender('6')).toBe('Female');
    });

    it('should find nearest slot matching Male patient (Youssef Ali) with Male doctor and currentLoad < 2', () => {
      const slot = service.findNearestSlot('5');
      expect(slot).toBeDefined();
      expect(slot.doctorId).toBeDefined();
      expect(slot.roomId).toBeDefined();
      expect(slot.scheduledAt).toBeDefined();

      const docGender = service.getDoctorGender(slot.doctorId);
      expect(docGender).toBe('Male');

      const room = service.rooms().find(r => r.id === slot.roomId);
      expect(room).toBeDefined();
      expect(room?.status).toBe('Available');
      expect(room?.currentLoad).toBe(0);
    });

    it('should find nearest slot matching Female patient (Sara Mahmoud) with Female doctor and currentLoad < 2', () => {
      const slot = service.findNearestSlot('6');
      expect(slot).toBeDefined();
      expect(slot.doctorId).toBeDefined();

      const docGender = service.getDoctorGender(slot.doctorId);
      expect(docGender).toBe('Female');
    });

    it('should throw error when finding slot for empty patient', () => {
      expect(() => service.findNearestSlot('')).toThrow();
    });
  });

  describe('Historical Date Filtering', () => {
    it('should have historical sessions in global sessions', () => {
      const sessions = service.sessions();
      const historical = sessions.filter(s => s.id.startsWith('hist_'));
      expect(historical.length).toBe(4);
    });

    it('should strictly exclude historical sessions when filtering by today', () => {
      const today = new Date().toISOString().split('T')[0];
      const todaySessions = service.sessions().filter(s => s.scheduledAt.startsWith(today));

      // None of the today's sessions should have id starting with 'hist_'
      const leakedHistory = todaySessions.filter(s => s.id.startsWith('hist_'));
      expect(leakedHistory.length).toBe(0);
    });
  });

  describe('Business Rule: Absence Policy (handleDoctorAbsence)', () => {
    it('should throw an error if absent doctor or senior doctor does not exist', () => {
      expect(() => service.handleDoctorAbsence('non_existent', 'doc_1')).toThrow('Both absent doctor and senior doctor must exist.');
      expect(() => service.handleDoctorAbsence('doc_1', 'non_existent')).toThrow('Both absent doctor and senior doctor must exist.');
    });

    it('should strictly throw error when absent doctor and senior doctor genders do not match', () => {
      // doc_1 is Female, doc_2 is Male
      expect(service.getDoctorGender('doc_1')).toBe('Female');
      expect(service.getDoctorGender('doc_2')).toBe('Male');

      expect(() => service.handleDoctorAbsence('doc_1', 'doc_2'))
        .toThrow('Senior doctor gender must match the absent doctor to cover sessions.');
    });

    it('should reassign 50% (Math.ceil) to senior doctor and cancel remaining 50% when doctor is absent', () => {
      // Female doctors: doc_1 (absent) and doc_3 (senior)
      const today = new Date().toISOString().split('T')[0];

      // Setup: ensure doc_1 has 3 'Pending' or 'Confirmed' sessions today
      const testSessions = [
        { id: 'abs_1', scheduledAt: `${today}T10:00:00`, patientId: '2', doctorId: 'doc_1', roomId: 'room_2', status: 'Confirmed' as const, type: 'Session' as const },
        { id: 'abs_2', scheduledAt: `${today}T11:00:00`, patientId: '4', doctorId: 'doc_1', roomId: 'room_5', status: 'Pending' as const, type: 'Session' as const },
        { id: 'abs_3', scheduledAt: `${today}T12:00:00`, patientId: '6', doctorId: 'doc_1', roomId: 'room_2', status: 'Confirmed' as const, type: 'Assessment' as const },
      ];

      // Set room_2 doctorId to doc_1
      service.reassignRoom('room_2', 'doc_1');

      // Update sessionsSig to have exactly these 3 eligible sessions for doc_1
      const currentOtherSessions = service.sessions().filter(s => s.doctorId !== 'doc_1');
      (service as any).sessionsSig.set([...currentOtherSessions, ...testSessions]);

      // Call handleDoctorAbsence: doc_1 absent, doc_3 senior
      service.handleDoctorAbsence('doc_1', 'doc_3');

      const updatedDoc1Sessions = service.sessions().filter(s => ['abs_1', 'abs_2', 'abs_3'].includes(s.id));
      
      // Math.ceil(3 / 2) = 2 covered by doc_3
      const covered = updatedDoc1Sessions.filter(s => s.doctorId === 'doc_3');
      expect(covered.length).toBe(2);
      expect(covered[0].id).toBe('abs_1');
      expect(covered[1].id).toBe('abs_2');

      // Remaining 1 cancelled
      const cancelled = updatedDoc1Sessions.filter(s => s.status === 'Cancelled');
      expect(cancelled.length).toBe(1);
      expect(cancelled[0].id).toBe('abs_3');

      // Room linked to cancelled session (abs_3 linked to room_2) should have doctorId cleared
      const room2 = service.rooms().find(r => r.id === 'room_2');
      expect(room2?.doctorId).toBeNull();
    });

    it('should properly split even number of sessions (e.g. 2 sessions -> 1 covered by senior, 1 redistributed to other doctor)', () => {
      // Male doctors: doc_4 (absent) and doc_2 (senior). doc_5 is available
      const today = new Date().toISOString().split('T')[0];

      const testSessions = [
        { id: 'male_1', scheduledAt: `${today}T14:00:00`, patientId: '1', doctorId: 'doc_4', roomId: 'room_1', status: 'Confirmed' as const, type: 'Session' as const },
        { id: 'male_2', scheduledAt: `${today}T15:00:00`, patientId: '3', doctorId: 'doc_4', roomId: 'room_3', status: 'Pending' as const, type: 'Session' as const },
      ];

      const otherSessions = service.sessions().filter(s => s.doctorId !== 'doc_4');
      (service as any).sessionsSig.set([...otherSessions, ...testSessions]);

      service.handleDoctorAbsence('doc_4', 'doc_2');

      const s1 = service.sessions().find(s => s.id === 'male_1');
      const s2 = service.sessions().find(s => s.id === 'male_2');

      // First 50% (1) covered by doc_2
      expect(s1?.doctorId).toBe('doc_2');
      expect(s1?.status).toBe('Confirmed');

      // Second 50% (1) redistributed to other doctor of same gender (doc_5)
      expect(s2?.doctorId).toBe('doc_5');
      expect(s2?.status).toBe('Pending');
    });

    it('should ignore In Progress or Completed sessions when handling absence', () => {
      const today = new Date().toISOString().split('T')[0];

      const testSessions = [
        { id: 'in_prog', scheduledAt: `${today}T09:00:00`, patientId: '1', doctorId: 'doc_4', roomId: 'room_1', status: 'In Progress' as const, type: 'Session' as const },
        { id: 'done', scheduledAt: `${today}T08:00:00`, patientId: '3', doctorId: 'doc_4', roomId: 'room_3', status: 'Completed' as const, type: 'Session' as const },
      ];

      const otherSessions = service.sessions().filter(s => s.doctorId !== 'doc_4');
      (service as any).sessionsSig.set([...otherSessions, ...testSessions]);

      // No Pending or Confirmed sessions
      service.handleDoctorAbsence('doc_4', 'doc_2');

      const s1 = service.sessions().find(s => s.id === 'in_prog');
      const s2 = service.sessions().find(s => s.id === 'done');

      expect(s1?.doctorId).toBe('doc_4');
      expect(s1?.status).toBe('In Progress');
      expect(s2?.doctorId).toBe('doc_4');
      expect(s2?.status).toBe('Completed');
    });
  });

  describe('Business Rule: Insurance Workflow Gate', () => {
    it('should strictly throw error when finding slot for Insurance patient whose approval is pending (Patient 7)', () => {
      expect(() => service.findNearestSlot('7')).toThrow('Insurance approval is pending. Cannot book sessions.');
    });

    it('should strictly throw error when calling addSession or bookSession for pending Insurance patient', async () => {
      await expect(service.addSession({
        patientId: '7',
        doctorId: 'doc_2',
        roomId: 'room_3',
        scheduledAt: '2026-09-14T10:00:00',
        type: 'Session'
      })).rejects.toThrow('Insurance approval is pending. Cannot book sessions.');

      await expect(service.bookSession({
        patientId: '7',
        doctorId: 'doc_2',
        roomId: 'room_3',
        scheduledAt: '2026-09-14T10:00:00',
        type: 'Session'
      })).rejects.toThrow('Insurance approval is pending. Cannot book sessions.');
    });

    it('should allow finding slot and booking for Approved Insurance patient (Patient 2 - Mona Zaki)', async () => {
      const slot = service.findNearestSlot('2');
      expect(slot).toBeDefined();
      expect(service.getDoctorGender(slot.doctorId)).toBe('Female');

      const initialCount = service.sessions().length;
      await service.addSession({
        patientId: '2',
        doctorId: slot.doctorId,
        roomId: slot.roomId,
        scheduledAt: slot.scheduledAt,
        type: 'Session'
      });
      expect(service.sessions().length).toBe(initialCount + 1);
    });

    it('should allow booking for non-insurance patients (Cash, Online)', async () => {
      const slot = service.findNearestSlot('5');
      expect(slot).toBeDefined();
    });

    it('should strictly throw error when a new patient attempts to book a standard Session instead of Assessment', async () => {
      // Patient 5 is a new patient
      expect(service.isPatientNew('5')).toBe(true);

      const openRoom = service.availableRooms()[0];
      await expect(service.addSession({
        patientId: '5',
        doctorId: 'doc_2',
        roomId: openRoom.id,
        scheduledAt: '2026-09-14T11:00:00',
        type: 'Session'
      })).rejects.toThrow('New patients must complete an Assessment session first.');
    });

    it('should allow a new patient to book an Assessment session', async () => {
      expect(service.isPatientNew('5')).toBe(true);

      const openRoom = service.availableRooms()[0];
      const initialCount = service.sessions().length;
      await service.addSession({
        patientId: '5',
        doctorId: 'doc_2',
        roomId: openRoom.id,
        scheduledAt: '2026-09-14T11:00:00',
        type: 'Assessment'
      });
      expect(service.sessions().length).toBe(initialCount + 1);
    });

    it('should allow an existing/old patient to book a standard Session', async () => {
      // Patient 1 is an existing patient
      expect(service.isPatientNew('1')).toBe(false);

      const openRoom = service.availableRooms()[0];
      const initialCount = service.sessions().length;
      await service.addSession({
        patientId: '1',
        doctorId: 'doc_2',
        roomId: openRoom.id,
        scheduledAt: '2026-09-14T12:00:00',
        type: 'Session'
      });
      expect(service.sessions().length).toBe(initialCount + 1);
    });
  });

  describe('Gender Matching & Slot Finding Edge Cases', () => {
    it('should throw clear error if candidateDoctors has no doctors of the matching gender', () => {
      // Patient 5 is Male. Candidate doctors list contains only female doctors.
      const femaleOnlyDoctors = service.doctors().filter(d => d.gender === 'Female');
      expect(() => service.findNearestSlot('5', femaleOnlyDoctors))
        .toThrow('No available male doctor found to treat this patient.');
    });

    it('should throw clear error if all doctors of the matching gender have currentLoad >= 2', () => {
      // Temporarily mark all Male doctors with high load in doctorAvailability
      (service as any).doctorAvailabilitySig.set([
        { doctorId: 'doc_2', currentLoad: 2, maxLoad: 3 },
        { doctorId: 'doc_4', currentLoad: 2, maxLoad: 3 },
        { doctorId: 'doc_5', currentLoad: 3, maxLoad: 3 },
      ]);

      expect(() => service.findNearestSlot('5'))
        .toThrow('No available male doctor found with current load under 2.');
    });
  });

  describe('Session Lifecycle & Room Synchronization', () => {
    it('should successfully check in a patient: marks room Occupied, currentLoad 1, assigns doctorId, sets session In Progress', async () => {
      // Ensure room_1 is Available with currentLoad 0
      (service as any).roomsSig.update((rooms: any[]) => rooms.map(r => r.id === 'room_1' ? { ...r, status: 'Available', currentLoad: 0, doctorId: null } : r));

      const today = new Date().toISOString().split('T')[0];
      const newSession = {
        id: 'test_checkin_1',
        patientId: '1',
        doctorId: 'doc_2',
        roomId: 'room_1',
        scheduledAt: `${today}T10:00:00`,
        status: 'Confirmed' as const,
        type: 'Session' as const
      };
      (service as any).sessionsSig.update((list: any[]) => [...list, newSession]);

      await service.checkInPatient('test_checkin_1');

      const updatedSession = service.sessions().find(s => s.id === 'test_checkin_1');
      expect(updatedSession?.status).toBe('In Progress');

      const room = service.rooms().find(r => r.id === 'room_1');
      expect(room?.status).toBe('Occupied');
      expect(room?.currentLoad).toBe(1);
      expect(room?.doctorId).toBe('doc_2');
    });

    it('should successfully check out a patient: sets session Completed, resets room to Available, currentLoad 0, clears doctorId', async () => {
      // Ensure room_1 is Occupied by doc_2
      (service as any).roomsSig.update((rooms: any[]) => rooms.map(r => r.id === 'room_1' ? { ...r, status: 'Occupied', currentLoad: 1, doctorId: 'doc_2' } : r));

      const today = new Date().toISOString().split('T')[0];
      const inProgressSession = {
        id: 'test_checkout_1',
        patientId: '1',
        doctorId: 'doc_2',
        roomId: 'room_1',
        scheduledAt: `${today}T10:00:00`,
        status: 'In Progress' as const,
        type: 'Session' as const
      };
      (service as any).sessionsSig.update((list: any[]) => [...list, inProgressSession]);

      // Mock invoice with status: 'Paid' so check-out is permitted
      (service as any).invoicesSig.update((list: any[]) => [
        ...list,
        {
          id: 'INV_checkout_test_paid',
          sessionId: 'test_checkout_1',
          patientId: '1',
          amount: 500,
          currency: 'EGP',
          status: 'Paid',
          type: 'Session',
          createdAt: `${today}T10:00:00Z`
        }
      ]);

      await service.checkOutPatient('test_checkout_1');

      const updatedSession = service.sessions().find(s => s.id === 'test_checkout_1');
      expect(updatedSession?.status).toBe('Completed');

      const room = service.rooms().find(r => r.id === 'room_1');
      expect(room?.status).toBe('Available');
      expect(room?.currentLoad).toBe(0);
      expect(room?.doctorId).toBeNull();
    });

    it('EDGE CASE / FAIL: Attempting to Check-out with an unpaid invoice throws an error', async () => {
      const today = new Date().toISOString().split('T')[0];
      const inProgressSession = {
        id: 'test_checkout_unpaid',
        patientId: '1',
        doctorId: 'doc_2',
        roomId: 'room_1',
        scheduledAt: `${today}T10:00:00`,
        status: 'In Progress' as const,
        type: 'Session' as const
      };
      (service as any).sessionsSig.update((list: any[]) => [...list, inProgressSession]);

      // Mock invoice with status: 'Pending' (Unpaid)
      (service as any).invoicesSig.update((list: any[]) => [
        ...list,
        {
          id: 'INV_checkout_unpaid',
          sessionId: 'test_checkout_unpaid',
          patientId: '1',
          amount: 500,
          currency: 'EGP',
          status: 'Pending',
          type: 'Session',
          createdAt: `${today}T10:00:00Z`
        }
      ]);

      await expect(service.checkOutPatient('test_checkout_unpaid'))
        .rejects.toThrow('Cannot check out: The invoice for this session has not been paid yet.');
    });

    it('should throw an error on check-in if 0 rooms are Available', async () => {
      // Set all rooms to Occupied or Maintenance
      (service as any).roomsSig.update((rooms: any[]) => rooms.map(r => ({ ...r, status: 'Occupied', currentLoad: 1 })));

      const newSession = {
        id: 'test_no_room',
        patientId: '1',
        doctorId: 'doc_2',
        roomId: 'room_1',
        scheduledAt: new Date().toISOString(),
        status: 'Confirmed' as const,
        type: 'Session' as const
      };
      (service as any).sessionsSig.update((list: any[]) => [...list, newSession]);

      await expect(service.checkInPatient('test_no_room'))
        .rejects.toThrow('No available rooms found for check-in.');
    });
  });

  describe('Doctor Absence: 5-Session Redistribution to Senior and Other Doctors', () => {
    it('SUCCESS: 50% Redistribution. If a doctor has 5 pending sessions, exactly 3 (Math.ceil) are reassigned to the Senior (doc_2), and 2 to the other available doctor (doc_5) with no cancellations', () => {
      const today = new Date().toISOString().split('T')[0];

      // Prepare 5 sessions for doc_4 (Male):
      const fiveSessions = [
        { id: 's1', scheduledAt: `${today}T09:00:00`, patientId: '1', doctorId: 'doc_4', roomId: 'room_1', status: 'Pending' as const, type: 'Session' as const },
        { id: 's2', scheduledAt: `${today}T10:00:00`, patientId: '3', doctorId: 'doc_4', roomId: 'room_2', status: 'Confirmed' as const, type: 'Session' as const },
        { id: 's3', scheduledAt: `${today}T11:00:00`, patientId: '5', doctorId: 'doc_4', roomId: 'room_3', status: 'Pending' as const, type: 'Assessment' as const },
        { id: 's4', scheduledAt: `${today}T12:00:00`, patientId: '1', doctorId: 'doc_4', roomId: 'room_4', status: 'Confirmed' as const, type: 'Session' as const },
        { id: 's5', scheduledAt: `${today}T13:00:00`, patientId: '3', doctorId: 'doc_4', roomId: 'room_5', status: 'Pending' as const, type: 'Session' as const },
      ];

      const otherSessions = service.sessions().filter(s => s.doctorId !== 'doc_4');
      (service as any).sessionsSig.set([...otherSessions, ...fiveSessions]);

      // Call handleDoctorAbsence: doc_4 absent, doc_2 senior (both Male). doc_5 is the other Male doctor.
      service.handleDoctorAbsence('doc_4', 'doc_2');

      const updated = service.sessions().filter(s => ['s1', 's2', 's3', 's4', 's5'].includes(s.id));

      // Exactly 3 (Math.ceil(5/2)) reassigned to senior doc_2
      const seniorReassigned = updated.filter(s => s.doctorId === 'doc_2');
      expect(seniorReassigned.length).toBe(3);
      expect(seniorReassigned.map(s => s.id)).toEqual(['s1', 's2', 's3']);

      // Remaining 2 reassigned to other available doctor of same gender (doc_5)
      const otherReassigned = updated.filter(s => s.doctorId === 'doc_5');
      expect(otherReassigned.length).toBe(2);
      expect(otherReassigned.map(s => s.id)).toEqual(['s4', 's5']);

      // Ensure NO sessions are marked as 'Cancelled'
      const cancelled = updated.filter(s => s.status === 'Cancelled');
      expect(cancelled.length).toBe(0);
    });

    it('FALLBACK: When no other doctors of same gender exist, remaining sessions are marked as Cancelled and their rooms released', () => {
      // Female doctors in mock-db: only doc_1 and doc_3 exist (otherDoctors is empty)
      const today = new Date().toISOString().split('T')[0];

      const femaleSessions = [
        { id: 'f1', scheduledAt: `${today}T09:00:00`, patientId: '2', doctorId: 'doc_1', roomId: 'room_2', status: 'Confirmed' as const, type: 'Session' as const },
        { id: 'f2', scheduledAt: `${today}T10:00:00`, patientId: '4', doctorId: 'doc_1', roomId: 'room_5', status: 'Pending' as const, type: 'Session' as const },
        { id: 'f3', scheduledAt: `${today}T11:00:00`, patientId: '6', doctorId: 'doc_1', roomId: 'room_4', status: 'Confirmed' as const, type: 'Assessment' as const },
      ];

      // Pre-set room_4 as Occupied with doc_1 to verify room release
      (service as any).roomsSig.update((rooms: any[]) => rooms.map(r => {
        if (r.id === 'room_4') {
          return { ...r, status: 'Occupied', currentLoad: 1, doctorId: 'doc_1' };
        }
        return r;
      }));

      const otherSessions = service.sessions().filter(s => s.doctorId !== 'doc_1');
      (service as any).sessionsSig.set([...otherSessions, ...femaleSessions]);

      // Call handleDoctorAbsence: doc_1 absent, doc_3 senior. otherDoctors for Female is empty.
      service.handleDoctorAbsence('doc_1', 'doc_3');

      const updated = service.sessions().filter(s => ['f1', 'f2', 'f3'].includes(s.id));

      // Math.ceil(3/2) = 2 to senior doc_3
      const seniorReassigned = updated.filter(s => s.doctorId === 'doc_3');
      expect(seniorReassigned.length).toBe(2);
      expect(seniorReassigned.map(s => s.id)).toEqual(['f1', 'f2']);

      // Remaining 1 Cancelled due to empty otherDoctors
      const cancelled = updated.filter(s => s.status === 'Cancelled');
      expect(cancelled.length).toBe(1);
      expect(cancelled[0].id).toBe('f3');

      // Room linked to cancelled session (room_4) is released
      const room4 = service.rooms().find(r => r.id === 'room_4');
      expect(room4?.status).toBe('Available');
      expect(room4?.currentLoad).toBe(0);
      expect(room4?.doctorId).toBeNull();
    });
  });

  describe('Centralized Financial & Revenue Computed Signals', () => {
    it('should compute todayInvoices, expectedTodayRevenue, collectedTodayRevenue, and breakdown accurately', async () => {
      const today = new Date().toISOString().split('T')[0];
      const pastDate = '2025-01-01';

      const testInvoices = [
        { id: 'inv_cash_paid', patientId: '1', amount: 500, currency: 'EGP', status: 'Paid' as const, paymentMethod: 'Cash', createdAt: `${today}T10:00:00Z` },
        { id: 'inv_card_paid', patientId: '2', amount: 300, currency: 'EGP', status: 'Paid' as const, paymentMethod: 'Credit Card', createdAt: `${today}T11:00:00Z` },
        { id: 'inv_wallet_paid', patientId: '3', amount: 200, currency: 'EGP', status: 'Paid' as const, paymentMethod: 'E-Wallet', createdAt: `${today}T12:00:00Z` },
        { id: 'inv_pending', patientId: '4', amount: 400, currency: 'EGP', status: 'Pending' as const, createdAt: `${today}T13:00:00Z` },
        { id: 'inv_partial', patientId: '5', amount: 150, currency: 'EGP', status: 'Partial' as const, createdAt: `${today}T14:00:00Z` },
        // Past invoice should not be included in today's calculations
        { id: 'inv_past_paid', patientId: '6', amount: 1000, currency: 'EGP', status: 'Paid' as const, paymentMethod: 'Cash', createdAt: `${pastDate}T10:00:00Z` }
      ];

      (service as any).invoicesSig.set(testInvoices);

      // todayInvoices filters only today's invoices
      expect(service.todayInvoices().length).toBe(5);

      // expectedTodayRevenue = sum of all today's invoices (500 + 300 + 200 + 400 + 150 = 1550)
      expect(service.expectedTodayRevenue()).toBe(1550);

      // collectedTodayRevenue = sum of Paid invoices (500 + 300 + 200 = 1000)
      expect(service.collectedTodayRevenue()).toBe(1000);

      // pendingTodayRevenue = Pending + Partial (400 + 150 = 550)
      expect(service.pendingTodayRevenue()).toBe(550);

      // cashCollectedToday = 500
      expect(service.cashCollectedToday()).toBe(500);

      // digitalCollectedToday = Credit Card (300) + E-Wallet (200) = 500
      expect(service.digitalCollectedToday()).toBe(500);

      // collectionRateToday = (1000 / 1550) * 100 = 65%
      expect(service.collectionRateToday()).toBe(Math.round((1000 / 1550) * 100));
    });
  });
});

