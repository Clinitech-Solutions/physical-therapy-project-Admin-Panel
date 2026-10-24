import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClinicStateService } from './clinic-state.service';
import { mockRooms } from '../../mock-data/mock-db';
import { Room } from '../../models/room.model';

describe('Persisted room initialization', () => {
  let previousRooms: string | null;
  const savedRoom: Room = {
    id: 'custom-room', displayName: 'Therapy room', status: 'Maintenance',
    doctorId: null, currentLoad: 0, capacity: 2
  };

  beforeEach(() => {
    previousRooms = localStorage.getItem('clinic_rooms');
    localStorage.removeItem('clinic_rooms');
    vi.useFakeTimers();
  });

  afterEach(async () => {
    await vi.runAllTimersAsync();
    vi.useRealTimers();
    if (previousRooms === null) localStorage.removeItem('clinic_rooms');
    else localStorage.setItem('clinic_rooms', previousRooms);
  });

  it('recovers the default rooms when an old empty array is cached', async () => {
    localStorage.setItem('clinic_rooms', '[]');
    const service = new ClinicStateService();
    await vi.runAllTimersAsync();
    expect(service.rooms().map(room => room.id)).toEqual(mockRooms.map(room => room.id));
    expect(service.rooms().length).toBeGreaterThan(0);
    expect(JSON.parse(localStorage.getItem('clinic_rooms')!)).toEqual(service.rooms());
  });

  it('preserves a nonempty saved room list instead of replacing it with defaults', async () => {
    localStorage.setItem('clinic_rooms', JSON.stringify([savedRoom]));
    const service = new ClinicStateService();
    await vi.runAllTimersAsync();
    expect(service.rooms()).toEqual([savedRoom]);
  });

  it('recovers rooms from an invalid cache', () => {
    localStorage.setItem('clinic_rooms', '{invalid json');
    const service = new ClinicStateService();
    expect(service.rooms().map(room => room.id)).toEqual(mockRooms.map(room => room.id));
  });

  it('keeps newly added rooms after recreating the service', async () => {
    localStorage.setItem('clinic_rooms', JSON.stringify([savedRoom]));
    const service = new ClinicStateService();
    const added = service.addNewRoom({ displayName: 'Second therapy room', capacity: 3 });
    await vi.runAllTimersAsync();
    const room = await added;
    const reloaded = new ClinicStateService();
    await vi.runAllTimersAsync();
    expect(reloaded.rooms()).toEqual([savedRoom, room]);
  });
});
