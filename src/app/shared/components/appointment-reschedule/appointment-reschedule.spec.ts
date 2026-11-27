import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AppointmentReschedule, rescheduleEligible } from './appointment-reschedule';
import { AuthService } from '../../../core/services/auth';
import { ReceptionEvents } from '../../../core/services/reception-api';
import { environment } from '../../../../environments/environment';
import { RescheduleAvailability } from '../../../core/models/patient-profile.model';

const target = {id:101,patientId:7,startTime:'2035-11-05T10:00:00Z',status:'Pending'};
const endpoint = `${environment.apiUrl}/Bookings/appointments/101`;
const availability: RescheduleAvailability = {
  appointmentId:101,version:'v1',currentStart:target.startTime,currentEnd:'2035-11-05T11:00:00Z',currentRoomId:1,
  clinicianId:'doctor',clinicianName:'Assigned Doctor',currentClinicianId:'doctor',currentClinicianName:'Assigned Doctor',
  date:'2035-11-05',slots:[{startTime:'2035-11-05T12:00:00Z',endTime:'2035-11-05T13:00:00Z',roomId:2,roomName:'Room 2',remainingCapacity:1}],notices:[],
  clinicians:[{id:'doctor',name:'Assigned Doctor',role:'Doctor'},{id:'alternate',name:'Eligible alternate',role:'Doctor'}],
};
describe('Audited schedule reschedule dialog',()=>{
  let c: AppointmentReschedule, http: HttpTestingController;
  const slots=()=>http.expectOne(r=>r.url===`${endpoint}/reschedule-slots`);
  beforeEach(()=>{
    sessionStorage.clear();
    TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting(),{provide:AuthService,useValue:{hasRole:(r:string)=>r==='Receptionist',currentUser:()=>({id:'employee'})}}]});
    http=TestBed.inject(HttpTestingController);c=TestBed.runInInjectionContext(()=>new AppointmentReschedule());
    c.target=target;c.ngOnChanges();slots().flush(availability);
  });
  afterEach(()=>{c.ngOnDestroy();http.verify();sessionStorage.clear();});
  it('requires reason and prevents duplicate submissions',async()=>{
    c.selected=availability.slots[0];await c.save();http.expectNone(r=>r.method==='PUT');
    c.reason='Patient request';const saved=c.save();void c.save();
    const req=http.expectOne(`${endpoint}/reschedule`);
    expect(req.request.body).toMatchObject({expectedVersion:'v1',clinicianId:'doctor',roomId:2,reason:'Patient request'});
    expect(req.request.body).not.toHaveProperty('actorId');
    const changed=vi.spyOn(TestBed.inject(ReceptionEvents).changed,'next');
    req.flush({appointmentId:101});await saved;expect(changed).toHaveBeenCalledWith('appointments');expect(c.pending()).toBeNull();
  });
  it('invalidates date and clinician availability and cancels superseded reads',()=>{
    c.selected=availability.slots[0];c.date='2035-11-06';c.load();const old=slots();
    expect(c.availability()).toBeNull();expect(c.selected).toBeNull();
    c.clinicianId='alternate';c.load();expect(old.cancelled).toBe(true);
    const next=slots();expect(next.request.params.get('clinicianId')).toBe('alternate');
    next.flush({...availability,clinicianId:'alternate'});expect(c.changed).toBe(false);
  });
  it('preserves date, clinician, reason and selection after recoverable failure',async()=>{
    c.selected=availability.slots[0];c.reason='Keep my reason';const date=c.date;
    const saved=c.save();http.expectOne(`${endpoint}/reschedule`).flush({title:'Booking.RescheduleRequest'},{status:400,statusText:'Bad Request'});await saved;
    expect(c.reason).toBe('Keep my reason');expect(c.date).toBe(date);expect(c.selected).toBe(availability.slots[0]);expect(c.pending()).toBeNull();
  });
  it('keeps uncertain intent across reopen and reconciles without another write',async()=>{
    c.selected=availability.slots[0];c.reason='Stable operation';const save=c.save();
    const req=http.expectOne(`${endpoint}/reschedule`),body=req.request.body;
    req.error(new ProgressEvent('offline'));await save;
    c.ngOnChanges();slots().flush(availability);
    expect(c.pending()?.operationKey).toBe(body.operationKey);await c.save();http.expectNone(r=>r.method==='PUT');
    const reconcile=c.reconcile();http.expectOne(`${endpoint}/reschedules/${body.operationKey}`).flush({appointmentId:101});await reconcile;
    expect(c.pending()).toBeNull();
  });
  it('rejects every clinically started or terminal appointment in the reception action',()=>{
    expect(rescheduleEligible(target)).toBe(true);
    for(const status of ['Completed','Cancelled','NoShow','InProgress',1,2,3,4])expect(rescheduleEligible({...target,status})).toBe(false);
    for(const field of ['actualCheckIn','actualCheckOut','treatmentStartedAt','treatmentEndedAt'])expect(rescheduleEligible({...target,[field]:'2035-11-05T10:01:00Z'})).toBe(false);
  });
});
