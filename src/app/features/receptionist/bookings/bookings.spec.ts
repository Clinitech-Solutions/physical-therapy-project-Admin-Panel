import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { BookingsComponent } from './bookings';
import { ClinicStateService } from '../../../core/services/state/clinic-state.service';
import { MessageService } from 'primeng/api';

import { Injector, runInInjectionContext } from '@angular/core';

describe('BookingsComponent Logic Unit Tests', () => {
  let component: BookingsComponent;
  let clinicState: ClinicStateService;
  let messageService: MessageService;

  beforeEach(async () => {
    clinicState = new ClinicStateService();
    messageService = new MessageService();
    // Wait for state initialization simulation
    await new Promise(resolve => setTimeout(resolve, 600));

    const injector = Injector.create({
      providers: [
        { provide: ClinicStateService, useValue: clinicState },
        { provide: MessageService, useValue: messageService }
      ]
    });

    component = runInInjectionContext(injector, () => new BookingsComponent());
  });

  describe('Assessment First Business Rule', () => {
    it('should detect new patient and lock sessionType to Assessment', () => {
      component.onPatientChange('5'); // Youssef Ali (New Patient)
      expect(component.isNewPatient).toBe(true);
      expect(component.sessionType).toBe('Assessment');
    });

    it('should detect existing patient as not new', () => {
      component.onPatientChange('1'); // Ahmed Fathy (Existing Patient)
      expect(component.isNewPatient).toBe(false);
    });
  });

  describe('Strict Gender Matching', () => {
    it('should return empty filteredDoctors when no patient is selected', () => {
      component.selectedPatientId = '';
      expect(component.filteredDoctors).toEqual([]);
    });

    it('should return only Male doctors when Male patient (Youssef Ali) is selected', () => {
      component.onPatientChange('5');
      const docs = component.filteredDoctors;
      expect(docs.length).toBeGreaterThan(0);
      docs.forEach(doc => {
        expect(doc.gender).toBe('Male');
      });
    });

    it('should return only Female doctors when Female patient (Sara Mahmoud) is selected', () => {
      component.onPatientChange('6');
      const docs = component.filteredDoctors;
      expect(docs.length).toBeGreaterThan(0);
      docs.forEach(doc => {
        expect(doc.gender).toBe('Female');
      });
    });

    it('should reset selectedDoctorId if changing patient to opposite gender', () => {
      component.onPatientChange('5'); // Male
      component.selectedDoctorId = 'doc_2'; // Dr. Omar (Male)
      expect(component.selectedDoctorId).toBe('doc_2');

      component.onPatientChange('6'); // Female
      // Previous male doctor should be automatically cleared
      expect(component.selectedDoctorId).toBe('');
    });
  });

  describe('Walk-in Nearest Slot Finding', () => {
    it('should auto-fill doctor, room, and date within filteredDoctors for male patient', () => {
      component.onPatientChange('5');
      component.handleWalkInNearestSlot();

      expect(component.selectedDoctorId).toBeTruthy();
      expect(component.selectedRoomId).toBeTruthy();
      expect(component.scheduledDate).toBeInstanceOf(Date);

      const assignedDoc = component.allDoctors().find(d => d.id === component.selectedDoctorId);
      expect(assignedDoc?.gender).toBe('Male');
    });

    it('should auto-fill female doctor for female patient', () => {
      component.onPatientChange('6');
      component.handleWalkInNearestSlot();

      const assignedDoc = component.allDoctors().find(d => d.id === component.selectedDoctorId);
      expect(assignedDoc?.gender).toBe('Female');
    });
  });

  describe('Schedule Filtering & Card Styling', () => {
    it('should filter today sessions by status', () => {
      component.selectedFilter = 'All';
      const allSlots = component.filteredSchedule;
      const allCount = allSlots.reduce((acc, slot) => acc + slot.sessions.length, 0);

      component.selectedFilter = 'In Progress';
      const inProgressSlots = component.filteredSchedule;
      const inProgressCount = inProgressSlots.reduce((acc, slot) => acc + slot.sessions.length, 0);
      expect(inProgressCount).toBe(2); // 2 in progress today in mock-db
      inProgressSlots.forEach(slot => {
        slot.sessions.forEach(s => expect(s.status).toBe('In Progress'));
      });

      component.selectedFilter = 'Upcoming';
      const upcomingSlots = component.filteredSchedule;
      upcomingSlots.forEach(slot => {
        slot.sessions.forEach(s => {
          expect(['Pending', 'Confirmed']).toContain(s.status);
        });
      });
    });

    it('should map distinct CSS classes based on session status', () => {
      expect(component.getStatusClass('Completed')).toBe('status-completed');
      expect(component.getStatusClass('In Progress')).toBe('status-in-progress');
      expect(component.getStatusClass('Pending')).toBe('status-pending');
      expect(component.getStatusClass('Confirmed')).toBe('status-confirmed');
      expect(component.getStatusClass('Cancelled')).toBe('status-cancelled');
    });
  });

  describe('Doctor Absence Reporting & Reassignment', () => {
    it('should return empty coveringSeniors when absentDoctorId is null', () => {
      component.absentDoctorId = null;
      expect(component.coveringSeniors).toEqual([]);
    });

    it('should filter coveringSeniors to same gender excluding the absent doctor (Female case)', () => {
      // doc_1 is Female (Dr. Sarah)
      component.absentDoctorId = 'doc_1';
      const seniors = component.coveringSeniors;
      expect(seniors.length).toBeGreaterThan(0);
      seniors.forEach(senior => {
        expect(senior.id).not.toBe('doc_1');
        expect(senior.gender).toBe('Female');
      });
      // In mock DB, Dr. Noha (doc_3) is Female
      expect(seniors.some(s => s.id === 'doc_3')).toBe(true);
    });

    it('should filter coveringSeniors to same gender excluding the absent doctor (Male case)', () => {
      // doc_2 is Male (Dr. Omar)
      component.absentDoctorId = 'doc_2';
      const seniors = component.coveringSeniors;
      expect(seniors.length).toBeGreaterThan(0);
      seniors.forEach(senior => {
        expect(senior.id).not.toBe('doc_2');
        expect(senior.gender).toBe('Male');
      });
      expect(seniors.some(s => s.id === 'doc_2')).toBe(false);
      expect(seniors.some(s => s.id === 'doc_4')).toBe(true);
      expect(seniors.some(s => s.id === 'doc_5')).toBe(true);
    });

    it('should reset coveringSeniorId if it becomes invalid when absent doctor changes', () => {
      component.absentDoctorId = 'doc_2'; // Male
      component.coveringSeniorId = 'doc_4'; // Male
      expect(component.coveringSeniorId).toBe('doc_4');

      component.absentDoctorId = 'doc_1'; // Female
      component.onAbsentDoctorChange();
      expect(component.coveringSeniorId).toBeNull();
    });

    it('should call handleDoctorAbsence, display success toast, and reset modal on confirmAbsence', () => {
      component.showAbsenceModal = true;
      component.absentDoctorId = 'doc_1';
      component.coveringSeniorId = 'doc_3';

      let messageAdded: any = null;
      messageService.add = (msg: any) => {
        messageAdded = msg;
      };

      component.confirmAbsence();

      expect(messageAdded).toBeTruthy();
      expect(messageAdded.severity).toBe('success');
      expect(messageAdded.detail).toBe('Absence recorded. 50% of sessions reassigned to Senior, remainder distributed to available doctors.');
      expect(component.showAbsenceModal).toBe(false);
      expect(component.absentDoctorId).toBeNull();
      expect(component.coveringSeniorId).toBeNull();
    });

    it('should show error toast if confirmAbsence is called with invalid doctors', () => {
      component.absentDoctorId = 'doc_1'; // Female
      component.coveringSeniorId = 'doc_2'; // Male

      let messageAdded: any = null;
      messageService.add = (msg: any) => {
        messageAdded = msg;
      };

      component.confirmAbsence();

      expect(messageAdded).toBeTruthy();
      expect(messageAdded.severity).toBe('error');
      expect(messageAdded.summary).toBe('Absence Error');
    });
  });

  describe('Insurance & Booking Gates (The Gates)', () => {
    it('should block booking and show error toast when Insurance patient has Pending status (Patient 7)', async () => {
      component.onPatientChange('7'); // Patient 7: Insurance pending
      expect(component.isInsurancePending).toBe(true);

      let messageAdded: any = null;
      messageService.add = (msg: any) => {
        messageAdded = msg;
      };

      // Walk-in attempt
      component.handleWalkInNearestSlot();
      expect(messageAdded).toBeTruthy();
      expect(messageAdded.severity).toBe('error');
      expect(messageAdded.detail).toBe('Insurance approval is pending. Cannot book sessions.');

      // Submit booking attempt
      messageAdded = null;
      component.selectedDoctorId = 'doc_2';
      component.selectedRoomId = 'room_1';
      component.scheduledDate = new Date();

      await component.submitBooking();
      expect(messageAdded).toBeTruthy();
      expect(messageAdded.severity).toBe('error');
      expect(messageAdded.detail).toBe('Insurance approval is pending. Cannot book sessions.');
    });

    it('should allow booking for Approved Insurance patient (Patient 2 - Mona Zaki)', async () => {
      component.onPatientChange('2'); // Patient 2: Female, Insurance Approved
      expect(component.isInsurancePending).toBe(false);
      expect(component.isNewPatient).toBe(false);

      // Choose female doctor and available room
      component.sessionType = 'Session';
      component.selectedDoctorId = 'doc_1'; // Dr. Sarah (Female)
      const openRoom = component.availableRooms()[0];
      component.selectedRoomId = openRoom.id;
      component.scheduledDate = new Date('2026-09-15T14:00:00');

      let messageAdded: any = null;
      messageService.add = (msg: any) => {
        messageAdded = msg;
      };

      await component.submitBooking();
      expect(messageAdded).toBeTruthy();
      expect(messageAdded.severity).toBe('success');
      expect(messageAdded.summary).toBe('Booking Successful');
    });

    it('should allow old patient to book standard Session', async () => {
      component.onPatientChange('1'); // Patient 1: Male, Cash, Existing
      expect(component.isNewPatient).toBe(false);

      component.sessionType = 'Session';
      component.selectedDoctorId = 'doc_2'; // Dr. Omar (Male)
      const openRoom = component.availableRooms()[0];
      component.selectedRoomId = openRoom.id;
      component.scheduledDate = new Date('2026-09-15T15:00:00');

      let messageAdded: any = null;
      messageService.add = (msg: any) => {
        messageAdded = msg;
      };

      await component.submitBooking();
      expect(messageAdded).toBeTruthy();
      expect(messageAdded.severity).toBe('success');
      expect(messageAdded.detail).toContain('Session booked');
    });
  });
});
