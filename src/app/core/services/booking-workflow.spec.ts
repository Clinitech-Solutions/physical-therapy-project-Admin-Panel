import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { MessageService } from 'primeng/api';
import { BookingsComponent } from '../../features/receptionist/bookings/bookings';
import { BookingService } from './booking.service';
import { PatientService } from './patient.service';
import { ClinicianService } from './clinician.service';
import { BookingContext, BookingPreview, BookingReceipt } from '../models/booking.model';
import { environment } from '../../../environments/environment';
import { ReceptionRefreshService } from './reception-refresh.service';
import { AppointmentWorkflowService } from './appointment-workflow.service';

const url = environment.apiUrl;
const context: BookingContext = { patientId: 1, patientName: 'Test patient', gender: 'Male', paymentType: 'Cash', hasCompletedAssessment: false,
  isInsurance: false, insuranceApproved: false, remainingApprovedSessions: null, copayPercentage: null, insuranceCompanyName: null, assessments: [], plans: [] };
const plan = { id: 5, doctorId: 'doctor', doctorName: 'Doctor', treatmentType: 'Physio', plannedSessions: 6, bookedSessions: 1, completedSessions: 0, remainingSessions: 5 };
const quote: BookingPreview = { canSave: true, appointments: [{ startTime: '2030-02-04T10:00:00Z', endTime: '2030-02-04T11:00:00Z', conflicts: [] }],
  errors: [], totalAmount: 100, patientAmount: 100, insuranceAmount: 0, deposit: 0, remainingAmount: 100, waiverReason: null };
const receipt = (key: string): BookingReceipt => ({ idempotencyKey: key, patientId: 1, outcome: 'Committed',
  appointments: [{ id: 10, treatmentPlanSessionId: null, startTime: quote.appointments[0].startTime, endTime: quote.appointments[0].endTime }],
  invoiceIds: [20], totalAmount: 100, patientAmount: 100, insuranceAmount: 0, paidAmount: 0, remainingAmount: 100, waiverReason: null, installments: [] });

describe('Patient-first booking workflow', () => {
  let http: HttpTestingController; let component: BookingsComponent;
  beforeEach(() => {
    sessionStorage.removeItem('ptcenter.pending-booking-key'); sessionStorage.removeItem('ptcenter.pending-collection-key');
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), MessageService] });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(PatientService).patients.set([{ id: '1', nameEn: 'Test patient', nameAr: '', avatar: 'TP', phone: '010', gender: 'Male', paymentType: 'Cash', lastVisit: '', documents: { medicalConsent: false, liabilityWaiver: false, idCard: false } }]);
    component = TestBed.runInInjectionContext(() => new BookingsComponent());
  });
  afterEach(() => { http.verify(); sessionStorage.removeItem('ptcenter.pending-booking-key'); sessionStorage.removeItem('ptcenter.pending-collection-key'); });
  async function select(value = context) {
    const loading = component.onPatientChange('1');
    http.expectOne(`${url}/Bookings/patients/1`).flush(value); await Promise.resolve();
    http.expectOne(`${url}/Rooms`).flush([{ id: 1, name: 'Room', capacity: 1, isActive: true, status: 'Available' }]);
    http.expectOne(`${url}/Rooms/availability`).flush([{ id: 1, name: 'Room', capacity: 1, isActive: true, status: 'Available' }]);
    http.expectOne(request => request.url === `${url}/Bookings/patients/1/clinicians`).flush([
      { id: value.hasCompletedAssessment ? 'doctor' : 'senior', name: 'Clinician', gender: 'Male', role: value.hasCompletedAssessment ? 'Doctor' : 'Senior', preferred: value.hasCompletedAssessment, currentLoad: 0 }
    ]);
    await loading;
    component.selectedDoctorId = value.hasCompletedAssessment ? 'doctor' : 'senior'; component.selectedRoomId = '1'; component.scheduledDate = new Date('2030-02-04T10:00:00Z');
  }
  async function preview() {
    http.match(`${url}/Rooms/availability`).forEach(request => request.flush([{ id: 1, name: 'Room', capacity: 1, isActive: true, status: 'Available' }]));
    const pending = component.previewBooking(); const request = http.expectOne(`${url}/Bookings/preview`); request.flush(quote); await pending; return request;
  }
  it('loads only the patient directory before selection', () => {
    component.ngOnInit(); http.expectOne(r => r.url.endsWith('/Bookings/patients')).flush({ items: [], pageNumber: 1, totalPages: 1, hasNextPage: false });
    http.expectNone(r => /Bookings|Users|Insurance|TreatmentPlan|Assessments|Billing|Rooms|Appointments/.test(r.url));
  });
  it('shows only server-confirmed available rooms and clears a room that becomes booked', async () => {
    await select(); component.roomService.load();
    http.expectOne(`${url}/Rooms`).flush([
      { id: 1, name: 'Occupied', capacity: 1, isActive: true, status: 'Occupied' },
      { id: 2, name: 'Free', capacity: 1, isActive: true, status: 'Available' },
    ]);
    const request = http.expectOne(`${url}/Rooms/availability`);
    expect(request.request.body).toEqual({ startsAt: ['2030-02-04T10:00:00.000Z'] });
    request.flush([{ id: 2, name: 'Free', capacity: 1, isActive: true, status: 'Available' }]);
    expect(component.availableRooms().map(room => room.id)).toEqual(['2']);
    expect(component.selectedRoomId).toBe('');
  });
  it('ignores an older room-availability request when the chosen time changes', async () => {
    await select(); component.refreshRoomAvailability();
    const older = http.expectOne(`${url}/Rooms/availability`);
    component.scheduledDate = new Date('2030-02-05T10:00:00Z'); component.refreshRoomAvailability();
    expect(older.cancelled).toBe(true);
    http.expectOne(`${url}/Rooms/availability`).flush([]);
    expect(component.availableRooms()).toEqual([]); expect(component.selectedRoomId).toBe('');
  });
  it('refreshes room status and the booking dropdown only after confirmed checkout', async () => {
    await select(); component.refreshRoomAvailability(); http.expectOne(`${url}/Rooms/availability`).flush([]);
    TestBed.inject(ReceptionRefreshService);
    const checkout = firstValueFrom(TestBed.inject(AppointmentWorkflowService).transition(10, 'Completed'));
    http.expectOne(`${url}/Receptionist/appointments/10/status`).flush(null); await checkout;
    http.expectOne(r => r.url.endsWith('/Appointments/GetAll')).flush({ items: [], totalPages: 0 });
    http.expectOne(`${url}/Rooms`).flush([{ id: 1, name: 'Room', capacity: 1, isActive: true, status: 'Available' }]);
    http.expectOne(`${url}/Rooms/availability`).flush([{ id: 1, name: 'Room', capacity: 1, isActive: true, status: 'Available' }]);
    http.expectOne(`${url}/Billing/invoices`).flush([]);
    http.expectOne(`${url}/Receptionist/dashboard-stats`).flush({ todaysSessions: 0, completedSessions: 0, pendingPayments: 0, totalExpectedToday: 0, totalCollectedToday: 0, collectionRate: 0 });
    http.expectOne(r => r.url.endsWith('/Receptionist/today-sessions')).flush({ items: [], totalPages: 0 });
    expect(component.availableRooms().map(room => room.id)).toEqual(['1']);
    expect(component.roomService.rooms()[0].status).toBe('Available');
  });
  it('uses completed-assessment evidence and matching Seniors, rather than an empty cache or a guessed status', async () => {
    await select(); expect(component.isNewPatient).toBe(true); expect(component.sessionTypeOptions.map(o => o.value)).toEqual(['Assessment']);
    expect(component.filteredDoctors.map(d => d.id)).toEqual(['senior']); component.setBookingMode('plan'); expect(component.bookingMode).toBe('single');
    TestBed.inject(ClinicianService).clinicians.update(list => [...list, { id: 'wrong-gender', name: 'Wrong', gender: 'Female', roles: ['Senior'] }, { id: 'wrong-role', name: 'Wrong', gender: 'Male', roles: ['Doctor'] }]);
    expect(component.filteredDoctors.map(d => d.id)).toEqual(['senior']);
  });
  it('offers a cash assessment choice without inventing a price and calculates a 60 minute end', async () => {
    await select(); expect(component.assessmentCharge).toBeNull(); expect(component.unitPrice).toBeNull();
    expect(component.scheduledEndDate?.toISOString()).toBe('2030-02-04T11:00:00.000Z');
    component.assessmentCharge = 'Paid'; component.unitPrice = 150;
    const request = await preview(); expect(request.request.body).toMatchObject({ assessmentCharge: 'Paid', unitPrice: 150, deposit: 0 });
    expect(request.request.body).not.toHaveProperty('endTime');
  });
  it('allows a pending-insurance assessment as a waived zero-liability appointment', async () => {
    await select({ ...context, isInsurance: true, paymentType: 'Insurance' });
    expect(component.isInsurancePending).toBe(false); expect(component.isWaivedAssessment).toBe(true);
    const request = await preview(); expect(request.request.body).toMatchObject({ assessmentCharge: 'Free', unitPrice: null, packagePrice: null, deposit: 0, discount: 0, installments: [] });
  });
  it('requires a saved plan for treatment and prefers its assigned doctor while allowing eligible alternatives', async () => {
    await select({ ...context, hasCompletedAssessment: true, plans: [plan] });
    expect(component.sessionType).toBe('Session'); expect(component.selectedPlanId).toBe(5); expect(component.selectedDoctorId).toBe('doctor');
    expect(component.chosenPlan).toMatchObject({ plannedSessions: 6, bookedSessions: 1, completedSessions: 0 });
    component.unitPrice = 100; expect((await preview()).request.body.treatmentPlanId).toBe(5);
  });
  it('previews every bulk slot, package agreement and installment before saving', async () => {
    await select({ ...context, hasCompletedAssessment: true, plans: [plan] }); component.setBookingMode('plan');
    component.planSessionCount = 3; component.planStartDate = new Date(2030, 1, 4); component.planPreferredTime = new Date(2030, 1, 4, 10); component.selectedDays = [0, 1, 2, 3, 4, 5, 6];
    component.pricingMode = 'Package'; component.packagePrice = 900; component.discount = 100; component.deposit = 100; component.paymentMethod = 'Cash'; component.installments = [{ dueDate: '2030-03-01', amount: 700 }];
    const request = await preview(); expect(request.request.body.startsAt).toHaveLength(3);
    expect(request.request.body).toMatchObject({ pricingMode: 'Package', packagePrice: 900, discount: 100, deposit: 100, paymentMethod: 'Cash', installments: [{ dueDate: '2030-03-01', amount: 700 }] });
  });
  it('requires a fresh valid preview, prevents duplicate clicks, and does not POST invoices separately', async () => {
    await select(); component.assessmentCharge = 'Paid'; component.unitPrice = 100; await preview();
    component.unitPrice = 101; expect(component.canConfirm).toBe(false); component.unitPrice = 100;
    const saving = component.submitBooking(); await component.submitBooking(); const request = http.expectOne(`${url}/Bookings`);
    expect(request.request.body.idempotencyKey).toBeTruthy(); request.flush(receipt(request.request.body.idempotencyKey)); await Promise.resolve();
    http.expectOne(`${url}/Bookings/patients/1`).flush(context); await saving;
    http.expectNone(`${url}/Billing/invoices`); expect(component.lastReceipt()?.paidAmount).toBe(0); expect(component.preview()).toBeNull();
  });
  it('retains the same request and key after an unknown outcome and reconciles before a new booking', async () => {
    await select(); component.assessmentCharge = 'Paid'; component.unitPrice = 100; await preview();
    const saving = component.submitBooking(); const request = http.expectOne(`${url}/Bookings`); const key = request.request.body.idempotencyKey;
    request.error(new ProgressEvent('error')); await saving;
    expect(component.bookingApi.uncertainKey()).toBe(key); expect(component.canConfirm).toBe(false);
    const reconciliation = component.reconcileBooking(); http.expectOne(`${url}/Bookings/operations/${key}`).flush(receipt(key)); await reconciliation;
    expect(component.bookingApi.uncertainKey()).toBeNull(); expect(component.lastReceipt()?.appointments[0].id).toBe(10);
    http.expectNone(`${url}/Bookings`);
  });
  it('retries an unconfirmed request with the original identity and body', async () => {
    await select(); component.assessmentCharge = 'Paid'; component.unitPrice = 100; await preview();
    const saving = component.submitBooking(); const original = http.expectOne(`${url}/Bookings`); original.error(new ProgressEvent('error')); await saving;
    const retry = component.retryPendingBooking(); const repeated = http.expectOne(`${url}/Bookings`); expect(repeated.request.body).toEqual(original.request.body);
    repeated.flush(receipt(repeated.request.body.idempotencyKey)); await Promise.resolve(); http.expectOne(`${url}/Bookings/patients/1`).flush(context); await retry;
  });
  it('does not report success for a malformed booking response or clear its reconciliation key', async () => {
    const api = TestBed.inject(BookingService); const result = firstValueFrom(api.create({ idempotencyKey: 'test-key' } as never)); const rejection = expect(result).rejects.toThrow('verified');
    http.expectOne(`${url}/Bookings`).flush(null); await rejection; expect(api.uncertainKey()).toBe('test-key');
  });
  it('retains an unresolved key if a retry receives a validation rejection', async () => {
    const api=TestBed.inject(BookingService);const request={idempotencyKey:'unresolved-key'} as never;
    const first=firstValueFrom(api.create(request)).catch(error=>error);http.expectOne(`${url}/Bookings`).error(new ProgressEvent('error'));await first;
    const retry=firstValueFrom(api.create(request)).catch(error=>error);http.expectOne(`${url}/Bookings`).flush({title:'Validation failed'},{status:400,statusText:'Bad Request'});await retry;
    expect(api.uncertainKey()).toBe('unresolved-key');
  });
  it('reuses the collection identity after a network failure and reconciles the saved collection', async () => {
    const api=TestBed.inject(BookingService);
    const first=firstValueFrom(api.collectAccount('account-key',50,'Cash')).catch(error=>error);
    const original=http.expectOne(`${url}/Bookings/accounts/account-key/payments`);original.error(new ProgressEvent('error'));await first;
    const key=api.pendingCollection()!.key;
    const retry=firstValueFrom(api.collectAccount('account-key',50,'Cash')).catch(error=>error);
    const repeated=http.expectOne(`${url}/Bookings/accounts/account-key/payments`);expect(repeated.request.body).toEqual(original.request.body);
    repeated.flush({title:'Booking.ConcurrentChange'},{status:409,statusText:'Conflict'});await retry;
    expect(api.pendingCollection()?.key).toBe(key);
    const reconciliation=firstValueFrom(api.reconcileCollection());
    http.expectOne(`${url}/Bookings/accounts/account-key/payments/${key}`).flush({...receipt('account-key'),paidAmount:50,remainingAmount:50});await reconciliation;
    expect(api.pendingCollection()).toBeNull();
  });
});
