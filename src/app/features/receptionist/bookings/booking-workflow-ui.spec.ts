/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { BookingsComponent } from './bookings';
import { environment } from '../../../../environments/environment';

const url = environment.apiUrl;
const en = JSON.parse(readFileSync('public/assets/i18n/en.json', 'utf8'));
const ar = JSON.parse(readFileSync('public/assets/i18n/ar.json', 'utf8'));
describe('Rendered patient-first booking controls', () => {
  let fixture: ComponentFixture<BookingsComponent>; let http: HttpTestingController;
  beforeEach(async () => {
    sessionStorage.removeItem('ptcenter.pending-booking-key'); sessionStorage.removeItem('ptcenter.pending-collection-key');
    await TestBed.configureTestingModule({ imports: [BookingsComponent, TranslateModule.forRoot()],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations(), provideRouter([]), MessageService] }).compileComponents();
    const translate = TestBed.inject(TranslateService); translate.setTranslation('en', en); translate.setTranslation('ar', ar); translate.use('en');
    http = TestBed.inject(HttpTestingController); fixture = TestBed.createComponent(BookingsComponent); fixture.detectChanges();
    http.expectOne(r => r.url === `${url}/Bookings/patients`).flush({ items: [{ id: 1, fullName: 'Patient', phoneNumber: '010', gender: 'Male' }], pageNumber: 1, totalPages: 1, hasNextPage: false });
    await fixture.whenStable();
  });
  afterEach(() => { fixture.destroy(); http.verify(); });
  async function select(isInsurance = false, treatment = false) {
    const pending = fixture.componentInstance.onPatientChange('1');
    http.expectOne(`${url}/Bookings/patients/1`).flush({ patientId: 1, patientName: 'Patient', gender: 'Male', paymentType: isInsurance ? 'Insurance' : 'Cash',
      hasCompletedAssessment: treatment, isInsurance, insuranceApproved: isInsurance && treatment, approvedSessions: isInsurance ? 4 : null,
      remainingApprovedSessions: isInsurance ? 4 : null, copayPercentage: isInsurance ? 20 : null, insuranceCompanyName: isInsurance ? 'Insurer' : null, assessments: [],
      plans: treatment ? [{id:5,doctorId:'doctor',doctorName:'Doctor',treatmentType:'Physio',plannedSessions:6,bookedSessions:1,completedSessions:1,remainingSessions:4,frequencyPerWeek:2,bookedStartsAt:[]}] : [] });
    await Promise.resolve();
    http.expectOne(`${url}/Rooms/availability`).flush([{id:1,name:'Room',capacity:1,isActive:true,status:'Available'}]);
    http.expectOne(r=>r.url===`${url}/Bookings/patients/1/clinicians`).flush([{id:treatment?'doctor':'senior',name:treatment?'Doctor':'Senior',gender:'Male',role:treatment?'Doctor':'Senior',preferred:true,currentLoad:0}]);
    await pending; await fixture.whenStable();
  }
  it('does not request clinical, insurance or clinician data before selection', () => {
    expect(fixture.componentInstance.bookingContext()).toBeNull();
    expect(fixture.nativeElement.querySelector('select[name="assessmentCharge"]')).toBeNull();
    http.expectNone(() => true);
  });
  it('shows explicit cash Free/Paid controls, keeps pricing through language changes and renders a read-only end', async () => {
    await select();
    const choice: HTMLSelectElement = fixture.nativeElement.querySelector('select[name="assessmentCharge"]');
    expect(choice).toBeTruthy(); expect(fixture.nativeElement.querySelector('input[name="unitPrice"]')).toBeNull();
    choice.value = 'Paid'; choice.dispatchEvent(new Event('change')); await fixture.whenStable();
    const price: HTMLInputElement = fixture.nativeElement.querySelector('input[name="unitPrice"]');
    price.value = '175.50'; price.dispatchEvent(new Event('input')); await fixture.whenStable();
    TestBed.inject(TranslateService).use('ar'); await fixture.whenStable();
    expect(fixture.componentInstance.unitPrice).toBe(175.5); expect(fixture.nativeElement.textContent).toContain(ar.RECEPTIONIST.UI.ASSESSMENT_CHARGE);
    expect(fixture.nativeElement.querySelector('[data-calculated-end]').tagName).toBe('OUTPUT');
    expect(fixture.nativeElement.querySelector('input[name="endTime"]')).toBeNull();
    const refreshedChoice: HTMLSelectElement = fixture.nativeElement.querySelector('select[name="assessmentCharge"]');
    refreshedChoice.value = 'Free'; refreshedChoice.dispatchEvent(new Event('change')); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('input[name="unitPrice"]')).toBeNull();
    expect(fixture.componentInstance.unitPrice).toBeNull();
  });
  it('shows the insurance assessment waiver policy without collecting a price, deposit or payment', async () => {
    await select(true);
    expect(fixture.nativeElement.querySelector('[data-insurance-assessment-policy]').textContent).toContain(en.RECEPTIONIST.UI.INSURANCE_ASSESSMENT_WAIVED_POLICY);
    expect(fixture.nativeElement.querySelector('select[name="assessmentCharge"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('input[name="deposit"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('input[name="unitPrice"]')).toBeNull();
    expect(fixture.componentInstance.isInsurancePending).toBe(false);
  });
  it('shows all three sections and the financial summary together without wizard navigation', async () => {
    await select(false,true);
    expect(fixture.nativeElement.querySelectorAll('[data-booking-section]').length).toBe(3);
    expect(fixture.nativeElement.querySelector('[data-booking-summary]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.wizard-steps')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-booking-confirm]').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-plan-counts]').textContent).toContain('6');
  });
  it('changes bulk days and dates without changing the prescribed course or claiming availability', async () => {
    await select(false,true);const component=fixture.componentInstance;
    component.setBookingMode('plan');
    http.expectOne(`${url}/Rooms/availability`).flush([{id:1,name:'Room',capacity:1,isActive:true,status:'Available'}]);
    await fixture.whenStable();
    const count:HTMLInputElement=fixture.nativeElement.querySelector('input[name="bookingCount"]');count.value='3';count.dispatchEvent(new Event('input'));await fixture.whenStable();
    http.expectOne(`${url}/Rooms/availability`).flush([{id:1,name:'Room',capacity:1,isActive:true,status:'Available'}]);
    await fixture.whenStable();
    expect(component.chosenPlan?.plannedSessions).toBe(6);expect(component.appointmentRows).toHaveLength(3);
    expect(fixture.nativeElement.querySelectorAll('.weekday-pill input')).toHaveLength(7);
    expect(fixture.nativeElement.querySelector('.slot-status').textContent).toContain(en.RECEPTIONIST.UI.BOOKING_PENDING_PREVIEW);
    expect(fixture.nativeElement.querySelectorAll('.slot-status.available')).toHaveLength(0);
    const checkbox:HTMLInputElement=fixture.nativeElement.querySelector('.weekday-pill input');checkbox.click();await fixture.whenStable();
    http.expectOne(`${url}/Rooms/availability`).flush([]);
    expect(component.selectedDays).not.toContain(1);expect(component.chosenPlan?.plannedSessions).toBe(6);
  });
  it('keeps approved limits and copay read-only and forces insurance package pricing', async () => {
    await select(true,true);
    const perSession:HTMLButtonElement=fixture.nativeElement.querySelector('[data-pricing-mode="PerSession"]');
    expect(perSession.disabled).toBe(true);expect(fixture.componentInstance.pricingMode).toBe('Package');
    expect(fixture.nativeElement.querySelector('select[name="discountType"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('input[name="discountValue"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('.insurance-facts').textContent).toContain('20%');
    expect(fixture.nativeElement.querySelector('.insurance-facts').textContent).toContain('4');
  });
  it('changes single date and time together while retaining a fixed one-hour duration', async () => {
    await select();const component=fixture.componentInstance;
    component.scheduledDate=new Date(2030,1,4,18,30);component.onBookingDateChange(new Date(2030,1,8));
    http.expectOne(`${url}/Rooms/availability`).flush([]);
    expect(component.scheduledDate?.getHours()).toBe(18);expect(component.scheduledDate?.getMinutes()).toBe(30);
    component.onBookingTimeChange(new Date(2030,0,1,19,15));http.expectOne(`${url}/Rooms/availability`).flush([]);
    expect(component.scheduledDate?.getDate()).toBe(8);expect(component.scheduledEndDate!.getTime()-component.scheduledDate!.getTime()).toBe(3600000);
  });
  it('enables confirmation only after a current server preview and invalidates it after a price edit', async () => {
    await select(false,true);const component=fixture.componentInstance;
    component.selectedRoomId='1';component.unitPrice=100;component.setPricingMode('Package');
    fixture.changeDetectorRef.markForCheck();fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-booking-preview]') as HTMLButtonElement).click();
    const request=http.expectOne(`${url}/Bookings/preview`);
    expect(request.request.body).toMatchObject({patientId:1,treatmentPlanId:5,pricingMode:'Package',unitPrice:100});
    request.flush({canSave:true,appointments:request.request.body.startsAt.map((startTime:string)=>({startTime,endTime:new Date(new Date(startTime).getTime()+3600000).toISOString(),conflicts:[]})),errors:[],totalAmount:600,patientAmount:600,insuranceAmount:0,discountAmount:0,deposit:0,remainingAmount:600,waiverReason:null});
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[data-booking-confirm]').disabled).toBe(false);
    expect(fixture.nativeElement.querySelectorAll('.slot-status.available')).toHaveLength(1);
    const input:HTMLInputElement=fixture.nativeElement.querySelector('input[name="unitPrice"]');input.value='101';input.dispatchEvent(new Event('input'));await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[data-booking-confirm]').disabled).toBe(true);
    expect(fixture.nativeElement.querySelectorAll('.slot-status.available')).toHaveLength(0);http.expectNone(`${url}/Bookings`);
  });
  it('clears payment drafts when cancelling without sending any write', async () => {
    await select(false,true);const component=fixture.componentInstance;
    component.unitPrice=500;component.discountType='Percent';component.discountValue=10;component.deposit=100;component.paymentMethod='Cash';
    component.resetBookingForm();await fixture.whenStable();
    expect(component.bookingContext()).toBeNull();expect(component.unitPrice).toBeNull();expect(component.deposit).toBe(0);expect(component.paymentMethod).toBeNull();expect(component.discountType).toBe('None');
    http.expectNone(r=>r.method==='POST');
  });
  it('limits selected weekdays to the saved prescription and warns once',async()=>{
    await select(false,true);const c=fixture.componentInstance;const messages=vi.spyOn(TestBed.inject(MessageService),'add');
    expect(c.selectedDays).toHaveLength(2);c.toggleBookingDay(6);
    expect(c.selectedDays).toHaveLength(2);expect(messages).toHaveBeenCalledTimes(1);expect(messages.mock.calls[0][0].severity).toBe('warn');
    http.expectNone(r=>r.method==='POST');
  });
  it('renders complete data for every one of ten generated rows and correlates the server preview',async()=>{
    await select(false,true);const c=fixture.componentInstance;
    c.bookingContext.update(value=>({...value!,plans:[{...value!.plans[0],plannedSessions:10,remainingSessions:10,bookedStartsAt:[]}]}));
    c.planSessionCount=10;c.planStartDate=new Date(2030,1,4);c.planPreferredTime=new Date(2030,1,4,18);c.setBookingMode('plan');
    http.expectOne(`${url}/Rooms/availability`).flush([{id:1,name:'Room',capacity:1,isActive:true,status:'Available'}]);
    c.selectedRoomId='1';c.unitPrice=100;
    const preview=c.previewBooking();const req=http.expectOne(`${url}/Bookings/preview`);const times=req.request.body.startsAt;
    expect(times).toHaveLength(10);expect(new Set(times).size).toBe(10);
    req.flush({canSave:true,appointments:times.map((startTime:string)=>({startTime,endTime:new Date(new Date(startTime).getTime()+3600000).toISOString(),conflicts:[]})),errors:[],totalAmount:1000,patientAmount:1000,insuranceAmount:0,discountAmount:0,deposit:0,remainingAmount:1000,waiverReason:null});await preview;
    fixture.changeDetectorRef.markForCheck();fixture.detectChanges();
    const rows=[...fixture.nativeElement.querySelectorAll('.appointment-table tbody tr')] as HTMLTableRowElement[];
    expect(rows).toHaveLength(10);for(const row of rows){expect(row.cells).toHaveLength(8);expect(row.cells[1].textContent?.trim()).toBeTruthy();expect(row.cells[5].textContent).toContain('Doctor');expect(row.cells[6].textContent).toContain('Room');}
    expect(c.canConfirm).toBe(true);
  });
});
