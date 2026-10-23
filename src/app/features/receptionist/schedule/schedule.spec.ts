import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { ScheduleComponent } from './schedule';
import { ReceptionistService } from '../../../core/services/receptionist.service';
import { BillingService } from '../../../core/services/billing.service';
import { MessageService } from 'primeng/api';
import { Injector, runInInjectionContext } from '@angular/core';
import { of } from 'rxjs';

describe('ScheduleComponent API Unit Tests', () => {
  let component: ScheduleComponent;
  let receptionistService: ReceptionistService;
  let billingService: BillingService;
  let messageService: MessageService;

  beforeEach(() => {
    messageService = new MessageService();

    const baseInjector = Injector.create({
      providers: [{ provide: MessageService, useValue: messageService }]
    });

    receptionistService = runInInjectionContext(baseInjector, () => new ReceptionistService());
    billingService = runInInjectionContext(baseInjector, () => new BillingService());

    // Populate API signal state on ReceptionistService
    receptionistService.todaySessions.set([
      {
        id: 101,
        patientId: 1,
        patientName: 'Ahmed Fathy',
        doctorId: 10,
        doctorName: 'Dr. Omar',
        roomId: 1,
        roomName: 'Room 1',
        appointmentType: 'Session',
        startTime: '2026-10-23T09:00:00',
        status: 'In Progress'
      },
      {
        id: 102,
        patientId: 2,
        patientName: 'Mona Zaki',
        doctorId: 11,
        doctorName: 'Dr. Sarah',
        roomId: 2,
        roomName: 'Room 2',
        appointmentType: 'Assessment',
        startTime: '2026-10-23T11:00:00',
        status: 'Confirmed'
      },
      {
        id: 103,
        patientId: 3,
        patientName: 'Omar Hassan',
        doctorId: 10,
        doctorName: 'Dr. Omar',
        roomId: 1,
        roomName: 'Room 1',
        appointmentType: 'Session',
        startTime: '2026-10-23T08:00:00',
        status: 'Completed'
      }
    ]);

    const injector = Injector.create({
      providers: [
        { provide: ReceptionistService, useValue: receptionistService },
        { provide: BillingService, useValue: billingService },
        { provide: MessageService, useValue: messageService }
      ]
    });

    component = runInInjectionContext(injector, () => new ScheduleComponent());
  });

  it('should filter today sessions from ReceptionistService by status and calculate KPI counts', () => {
    expect(component.totalTodayCount).toBe(3);
    expect(component.inProgressCount).toBe(1);
    expect(component.upcomingCount).toBe(1);
    expect(component.completedCount).toBe(1);

    component.selectedFilter = 'In Progress';
    const inProgressSlots = component.filteredSchedule;
    const inProgressCount = inProgressSlots.reduce((acc, slot) => acc + slot.sessions.length, 0);
    expect(inProgressCount).toBe(1);
    inProgressSlots.forEach((slot) => {
      slot.sessions.forEach((s) => expect(component.getMappedStatus(s.status)).toBe('In Progress'));
    });

    component.selectedFilter = 'Upcoming';
    const upcomingSlots = component.filteredSchedule;
    const upcomingCount = upcomingSlots.reduce((acc, slot) => acc + slot.sessions.length, 0);
    expect(upcomingCount).toBe(1);
    upcomingSlots.forEach((slot) => {
      slot.sessions.forEach((s) => {
        expect(['Pending', 'Confirmed']).toContain(component.getMappedStatus(s.status));
      });
    });
  });

  it('should map distinct CSS classes based on numeric or string session status', () => {
    expect(component.getStatusClass('Completed')).toBe('status-completed');
    expect(component.getStatusClass(3)).toBe('status-completed');
    expect(component.getStatusClass('In Progress')).toBe('status-in-progress');
    expect(component.getStatusClass(2)).toBe('status-in-progress');
    expect(component.getStatusClass('Pending')).toBe('status-pending');
    expect(component.getStatusClass(0)).toBe('status-pending');
    expect(component.getStatusClass('Confirmed')).toBe('status-confirmed');
    expect(component.getStatusClass(1)).toBe('status-confirmed');
    expect(component.getStatusClass('Cancelled')).toBe('status-cancelled');
    expect(component.getStatusClass(4)).toBe('status-cancelled');
  });

  it('should call ReceptionistService.updateSessionStatus on check-in and check-out', async () => {
    let calledId: number | null = null;
    let calledStatus: number | null = null;

    receptionistService.updateSessionStatus = (id: number, status: number) => {
      calledId = id;
      calledStatus = status;
      return of({});
    };

    await component.checkInSession(102);
    expect(calledId).toBe(102);
    expect(calledStatus).toBe(2); // In Progress

    await component.checkoutSession(101);
    expect(calledId).toBe(101);
    expect(calledStatus).toBe(3); // Completed
  });

  it('should call ReceptionistService.cancelSession on markPatientAbsent', () => {
    let cancelledId: number | null = null;
    receptionistService.cancelSession = (id: number) => {
      cancelledId = id;
      return of({});
    };

    component.markPatientAbsent(102);
    expect(cancelledId).toBe(102);
  });

  it('should reset filters cleanly', () => {
    component.searchQuery = 'Ahmed';
    component.selectedDoctorFilter = '10';
    component.selectedRoomFilter = '1';
    component.selectedFilter = 'Completed';

    component.resetFilters();

    expect(component.searchQuery).toBe('');
    expect(component.selectedDoctorFilter).toBe('');
    expect(component.selectedRoomFilter).toBe('');
    expect(component.selectedFilter).toBe('All');
  });
});
