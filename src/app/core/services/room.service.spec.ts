import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { RoomService } from './room.service';
import { ClinicianService, decodeClinicians } from './clinician.service';
import { AppointmentService } from './appointment.service';
import { environment } from '../../../environments/environment';
import { InsuranceService } from './insurance.service';

describe('Reception room and clinician integration contracts', () => {
  let rooms: RoomService;
  let http: HttpTestingController;
  const url = environment.apiUrl;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    rooms = TestBed.inject(RoomService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('exposes malformed insurer records rather than silently filtering them into an empty success', () => {
    const insurers = TestBed.inject(InsuranceService);
    insurers.getCompanies();
    http.expectOne(`${url}/InsuranceCompanies/GetAll`).flush([{ id: 'not-an-id', name: 'Insurer', isActive: true, portalUrl: null }]);
    expect(insurers.error()).toBeTruthy();
    expect(insurers.loading()).toBe(false);
  });
  it('loads the observed empty array without consulting room browser storage', () => {
    localStorage.setItem('clinic_rooms', '[{"id":"fake"}]');
    rooms.load(); http.expectOne(`${url}/Rooms`).flush([]);
    expect(rooms.rooms()).toEqual([]); expect(rooms.error()).toBeNull();
    localStorage.removeItem('clinic_rooms');
  });
  it('rejects unrecognized record fields instead of displaying fallback rooms', () => {
    rooms.load(); http.expectOne(`${url}/Rooms`).flush([{ displayName: 'Legacy' }]);
    expect(rooms.rooms()).toEqual([]); expect(rooms.error()).toBeTruthy();
  });
  it('keeps read failures visible and supports an explicit retry', () => {
    rooms.load(); http.expectOne(`${url}/Rooms`).flush({}, {status: 403, statusText: 'Forbidden'});
    expect(rooms.error()).toBeTruthy(); expect(rooms.loading()).toBe(false);
    rooms.load(); http.expectOne(`${url}/Rooms`).flush([]); expect(rooms.error()).toBeNull();
  });
  it('writes only the documented room fields and prevents overlapping operations', async () => {
    const data = { name: 'Therapy', capacity: 2, isActive: true };
    const result = firstValueFrom(rooms.create(data));
    await expect(firstValueFrom(rooms.create(data))).rejects.toThrow('in progress');
    const req = http.expectOne(`${url}/Rooms`); expect(req.request.method).toBe('POST'); expect(req.request.body).toEqual(data);
    req.flush(null); await result;
    expect(rooms.rooms()).toEqual([]); // no guessed success response ID
  });
  it('uses GET/PUT/DELETE record paths and the maintenance boolean body', async () => {
    const get = firstValueFrom(rooms.get(7));
    http.expectOne(`${url}/Rooms/7`).flush({id: 7, name: 'Contract fixture', capacity: 1, isActive: true}); await get;
    const update = firstValueFrom(rooms.update(7, { name: 'Edited', capacity: 2, isActive: false }));
    const put = http.expectOne(`${url}/Rooms/7`); expect(put.request.method).toBe('PUT'); put.flush(null); await update;
    const maintenance = firstValueFrom(rooms.maintenance(7, true));
    const patch = http.expectOne(`${url}/Rooms/7/maintenance`); expect(patch.request.method).toBe('PATCH'); expect(patch.request.body).toEqual({maintenance: true}); patch.flush(null); await maintenance;
    const remove = firstValueFrom(rooms.delete(7)); const del = http.expectOne(`${url}/Rooms/7`); expect(del.request.method).toBe('DELETE'); del.flush(null); await remove;
  });
  it('does not retry an uncertain room creation', async () => {
    const result = firstValueFrom(rooms.create({name: 'New', capacity: 1, isActive: true}));
    const rejected = expect(result).rejects.toThrow();
    http.expectOne(`${url}/Rooms`).error(new ProgressEvent('error')); await rejected;
    expect(rooms.mutation.uncertain()).toBe(true);
    await expect(firstValueFrom(rooms.create({name: 'New', capacity: 1, isActive: true}))).rejects.toThrow('verify');
  });
  it('rejects invalid room inputs before HTTP', async () => {
    await expect(firstValueFrom(rooms.create({name: '', capacity: 0, isActive: true}))).rejects.toThrow();
    http.expectNone(`${url}/Rooms`);
  });
  it('preserves clinician GUIDs and exposes lookup authorization failure', () => {
    const data = decodeClinicians({value:[{id:'doctor-guid',fullName:'Doctor',roles:['Doctor'],gender:0}]});
    expect(data[0].id).toBe('doctor-guid');
    const service = TestBed.inject(ClinicianService); service.load();
    http.expectOne(`${url}/Users/GetAll`).flush({}, {status:403,statusText:'Forbidden'});
    expect(service.clinicians()).toEqual([]); expect(service.error()).toBeTruthy();
  });
  it('uses the documented appointment POST and preserves string clinician IDs', async () => {
    const appts = TestBed.inject(AppointmentService);
    const result = firstValueFrom(appts.addAppointment({patientId:1,doctorId:'doctor-guid',roomId:2,appointmentType:'Assessment',startTime:'2026-11-01T09:00:00Z',endTime:'2026-11-01T10:00:00Z'}));
    const req=http.expectOne(`${url}/Appointments`); expect(req.request.body.doctorId).toBe('doctor-guid');
    req.flush(null); await result;
    http.expectNone(r=>r.url.endsWith('/Appointments/GetAll')); // refresh is separate from persistence
  });
});
