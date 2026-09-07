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

    it('should properly split even number of sessions (e.g. 2 sessions -> 1 covered, 1 cancelled)', () => {
      // Male doctors: doc_4 (absent) and doc_2 (senior)
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

      // Second 50% (1) cancelled
      expect(s2?.status).toBe('Cancelled');
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
});
