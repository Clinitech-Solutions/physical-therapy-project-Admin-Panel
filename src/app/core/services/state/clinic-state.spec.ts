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
});
