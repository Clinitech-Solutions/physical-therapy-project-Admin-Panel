import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { ScheduleComponent } from './schedule';
import { ClinicStateService } from '../../../core/services/state/clinic-state.service';
import { MessageService } from 'primeng/api';
import { Injector, runInInjectionContext } from '@angular/core';

describe('ScheduleComponent Unit Tests', () => {
  let component: ScheduleComponent;
  let clinicState: ClinicStateService;
  let messageService: MessageService;

  beforeEach(async () => {
    clinicState = new ClinicStateService();
    messageService = new MessageService();
    await new Promise((resolve) => setTimeout(resolve, 600));

    const injector = Injector.create({
      providers: [
        { provide: ClinicStateService, useValue: clinicState },
        { provide: MessageService, useValue: messageService }
      ]
    });

    component = runInInjectionContext(injector, () => new ScheduleComponent());
  });

  it('should filter today sessions by status and calculate KPI counts', () => {
    component.selectedFilter = 'All';
    const allSlots = component.filteredSchedule;
    const allCount = allSlots.reduce((acc, slot) => acc + slot.sessions.length, 0);
    expect(allCount).toBe(component.totalTodayCount);

    component.selectedFilter = 'In Progress';
    const inProgressSlots = component.filteredSchedule;
    const inProgressCount = inProgressSlots.reduce((acc, slot) => acc + slot.sessions.length, 0);
    expect(inProgressCount).toBe(component.inProgressCount);
    inProgressSlots.forEach((slot) => {
      slot.sessions.forEach((s) => expect(s.status).toBe('In Progress'));
    });

    component.selectedFilter = 'Upcoming';
    const upcomingSlots = component.filteredSchedule;
    upcomingSlots.forEach((slot) => {
      slot.sessions.forEach((s) => {
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

  it('should reset filters cleanly', () => {
    component.searchQuery = 'Ahmed';
    component.selectedDoctorFilter = 'doc_1';
    component.selectedRoomFilter = 'room_1';
    component.selectedFilter = 'Completed';

    component.resetFilters();

    expect(component.searchQuery).toBe('');
    expect(component.selectedDoctorFilter).toBe('');
    expect(component.selectedRoomFilter).toBe('');
    expect(component.selectedFilter).toBe('All');
  });
});

