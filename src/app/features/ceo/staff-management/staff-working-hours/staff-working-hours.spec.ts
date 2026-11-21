import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TranslateModule } from '@ngx-translate/core';
import { AddUserComponent } from '../add-user/add-user.component';
import { StaffListComponent } from '../staff-list/staff-list.component';
import { environment } from '../../../../../environments/environment';
import { User } from '../../../../core/services/user.service';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { StaffRow } from '../../../../core/services/ceo-workspace.service';
import { NgForm } from '@angular/forms';

describe('CEO user working-hours forms', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<AddUserComponent> | ComponentFixture<StaffListComponent>;
  const url = `${environment.apiUrl}/Users`;
  const friday = { dayOfWeek: 5, startTime: '19:00:00', endTime: '21:00:00' };
  const values = { fullName: 'Test Senior', userName: 'test.senior', password: 'Test@1234', gender: 0, birthDate: '1990-01-01', role: 'Senior', workingHours: [friday] };
  const user: User = { id: 'senior-id', fullName: values.fullName, userName: values.userName, roles: ['Senior'], gender: 'Male', birthDate: '1990-01-01T00:00:00', workingHours: [friday] };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AddUserComponent, StaffListComponent, TranslateModule.forRoot()],
      providers: [provideHttpClient(), provideHttpClientTesting(), {provide:ActivatedRoute,useValue:{queryParamMap:of(convertToParamMap({}))}}, {provide:Router,useValue:{navigate:vi.fn().mockResolvedValue(true)}}] }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn();
  });
  afterEach(() => { fixture?.destroy(); http.verify(); });

  function addForm() {
    const created = TestBed.createComponent(AddUserComponent); fixture = created; created.detectChanges();
    return created.componentInstance;
  }
  function editForm() {
    const created = TestBed.createComponent(StaffListComponent); fixture = created; created.detectChanges();
    http.expectOne(`${environment.apiUrl}/ceo/staff`).flush({items:[user],total:1,page:1,pageSize:20});
    vi.spyOn(created.componentInstance,'show').mockImplementation(()=>{});
    created.componentInstance.edit({...user,id:'senior-id',isActive:true,futureAppointments:0,version:'v1'} as StaffRow); created.detectChanges();
    return created.componentInstance;
  }

  it('shows seven weekday checkboxes and one shared time range, saved for every selected day', async () => {
    const component = addForm(); component.userForm.setValue({ ...values, workingHours: [] }); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-staff-working-hours]')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('input[type="checkbox"]')).toHaveLength(7);
    expect(fixture.nativeElement.querySelectorAll('input[type="time"]')).toHaveLength(2);
    expect(component.userForm.invalid).toBe(true);
    toggleDay(6); toggleDay(0); toggleDay(1);
    await setTime('[data-shared-start]', '08:00');
    await setTime('[data-shared-end]', '17:00');
    component.onSubmit(); component.onSubmit();
    const request = http.expectOne(`${url}/Add`);
    expect(request.request.body.workingHours).toEqual([6, 0, 1].map(dayOfWeek => ({ dayOfWeek, startTime: '08:00:00', endTime: '17:00:00' })));
    request.flush(user);
    expect(component.userForm.controls.workingHours.value).toEqual([]);
    http.expectNone(request => request.url.includes('/Bookings/'));
  });

  function toggleDay(day: number) {
    fixture.nativeElement.querySelector(`[data-weekday="${day}"]`).click(); fixture.detectChanges();
  }
  async function setTime(selector: string, value: string) {
    const input: HTMLInputElement = fixture.nativeElement.querySelector(selector);
    input.value = value; input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges(); await fixture.whenStable();
  }

  it('loads existing days/hours into Edit User and saves a changed shared range with the profile', async () => {
    const component = editForm();
    await fixture.whenStable(); fixture.detectChanges();
    expect(component.selected?.workingHours).toEqual([friday]);
    expect(component.selected?.birthDate?.slice(0,10)).toBe('1990-01-01');
    expect(component.selected?.gender).toBe('Male');
    expect(fixture.nativeElement.querySelector('[data-weekday="5"]').checked).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-shared-start]').value).toBe('19:00');
    toggleDay(2); toggleDay(5);
    await setTime('[data-shared-start]', '10:00'); await setTime('[data-shared-end]', '18:00');
    const changed = [{ dayOfWeek: 2, startTime: '10:00', endTime: '18:00' }];
    component.save({invalid:false,control:{markAllAsTouched:()=>{}}} as NgForm);
    const request = http.expectOne(`${url}/Update?userId=senior-id`);
    expect(request.request.body.workingHours).toEqual([{ dayOfWeek: 2, startTime: '10:00:00', endTime: '18:00:00' }]);
    expect(user.workingHours).toEqual([friday]);
    request.flush({ ...user, workingHours: changed });
    expect(component.selected).toBeNull();
    component.edit({...user,id:'senior-id',workingHours:changed,isActive:true,futureAppointments:0,version:'v2'} as StaffRow);
    expect(component.selected?.workingHours).toEqual(changed);
  });

  it.each([
    [],
    [{ dayOfWeek: null, startTime: '09:00', endTime: '10:00' }],
    [{ dayOfWeek: 1, startTime: '', endTime: '10:00' }],
    [{ dayOfWeek: 1, startTime: '09:00', endTime: '' }],
    [{ dayOfWeek: 1, startTime: '20:00', endTime: '09:00' }],
    [{ dayOfWeek: 1, startTime: '09:00', endTime: '09:00' }],
    [{ dayOfWeek: 1, startTime: '08:00', endTime: '12:00' }, { dayOfWeek: 1, startTime: '11:00', endTime: '15:00' }],
    [{ dayOfWeek: 1, startTime: '08:00', endTime: '12:00' }, { dayOfWeek: 2, startTime: '09:00', endTime: '13:00' }],
  ])('prevents missing, invalid or inconsistent shared schedules from creating a user: %j', (...hours) => {
    const component = addForm(); component.userForm.setValue({ ...values, workingHours: hours });
    component.onSubmit();
    expect(component.userForm.invalid).toBe(true); http.expectNone(`${url}/Add`);
  });

  it('updates all selected days when either shared time changes, keeping times when days are toggled', async () => {
    const component = addForm();
    component.userForm.setValue({ ...values, workingHours: [friday, { ...friday, dayOfWeek: 1 }] }); fixture.detectChanges();
    await setTime('[data-shared-start]', '18:00'); await setTime('[data-shared-end]', '22:00');
    expect(component.userForm.controls.workingHours.value).toEqual([1, 5].map(dayOfWeek => ({ dayOfWeek, startTime: '18:00', endTime: '22:00' })));
    toggleDay(0);
    expect(component.userForm.controls.workingHours.value.every(window => window.startTime === '18:00' && window.endTime === '22:00')).toBe(true);
    toggleDay(0); toggleDay(1); toggleDay(5);
    expect(component.userForm.invalid).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('CEO.STAFF.WORKING_DAYS_REQUIRED');
    toggleDay(6);
    expect(component.userForm.controls.workingHours.value).toEqual([{ dayOfWeek: 6, startTime: '18:00', endTime: '22:00' }]);
  });

  it('shows inline required and ordering errors and blocks saving until corrected', async () => {
    const component = addForm(); component.userForm.setValue({ ...values, workingHours: [] }); fixture.detectChanges();
    component.onSubmit(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('CEO.STAFF.WORK_START_REQUIRED');
    expect(fixture.nativeElement.textContent).toContain('CEO.STAFF.WORK_END_REQUIRED');
    toggleDay(5); await setTime('[data-shared-start]', '20:00'); await setTime('[data-shared-end]', '19:00');
    expect(fixture.nativeElement.textContent).toContain('CEO.STAFF.WORK_END_AFTER_START');
    expect(component.userForm.invalid).toBe(true); http.expectNone(`${url}/Add`);
    await setTime('[data-shared-end]', '21:00'); expect(component.userForm.valid).toBe(true);
  });

  it('requires an explicit shared range when editing an older schedule with different daily hours', async () => {
    const component = editForm();
    fixture.detectChanges(false);
    component.selected={...component.selected!,workingHours:[friday, { dayOfWeek: 1, startTime: '08:00', endTime: '12:00' }]}; fixture.changeDetectorRef.markForCheck(); fixture.detectChanges(false);
    expect(fixture.nativeElement.textContent).toContain('CEO.STAFF.WORKING_HOURS_CHOOSE_SHARED');
    expect(fixture.nativeElement.querySelector('[data-shared-start]').value).toBe('');
    component.save({invalid:false,control:{markAllAsTouched:()=>{}}} as NgForm);http.expectNone(`${url}/Update?userId=senior-id`);
    await setTime('[data-shared-start]', '09:00'); await setTime('[data-shared-end]', '17:00');
    expect(component.selected?.workingHours).toEqual([1, 5].map(dayOfWeek => ({ dayOfWeek, startTime: '09:00', endTime: '17:00' })));
    expect(component.selected?.workingHours).toHaveLength(2);
  });

  it('preserves Patient creation without a staff schedule', () => {
    const component = addForm(); component.userForm.setValue({ ...values, role: 'Patient', workingHours: [] }); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-staff-working-hours]')).toBeNull();
    component.onSubmit(); const request = http.expectOne(`${url}/Add`);
    expect(request.request.body.workingHours).toEqual([]); request.flush({ ...user, roles: ['Patient'], workingHours: [] });
  });

  it('keeps the selected days and shared range when saving the user fails', () => {
    const component = editForm();
    component.save({invalid:false,control:{markAllAsTouched:()=>{}}} as NgForm);
    const request = http.expectOne(`${url}/Update?userId=senior-id`);
    expect(request.request.body.workingHours).toEqual([friday]);
    request.flush({ detail: 'Unable to save user.' }, { status: 500, statusText: 'Error' });
    expect(component.selected?.id).toBe(user.id); expect(component.dialogError).toBeTruthy();
    expect(component.saving()).toBe(false);
  });
});
