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
  async function select(isInsurance = false) {
    const pending = fixture.componentInstance.onPatientChange('1');
    http.expectOne(`${url}/Bookings/patients/1`).flush({ patientId: 1, patientName: 'Patient', gender: 'Male', paymentType: isInsurance ? 'Insurance' : 'Cash',
      hasCompletedAssessment: false, isInsurance, insuranceApproved: false, remainingApprovedSessions: null, copayPercentage: null, insuranceCompanyName: null, assessments: [], plans: [] });
    await Promise.resolve(); http.expectOne(`${url}/Rooms`).flush([{ id: 1, name: 'Room', capacity: 1, isActive: true }]);
    http.expectOne(r => r.url === `${url}/Bookings/patients/1/clinicians`).flush([{ id: 'senior', name: 'Senior', gender: 'Male', role: 'Senior', preferred: false, currentLoad: 0 }]);
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
    choice.value = 'Free'; choice.dispatchEvent(new Event('change')); await fixture.whenStable();
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
});
