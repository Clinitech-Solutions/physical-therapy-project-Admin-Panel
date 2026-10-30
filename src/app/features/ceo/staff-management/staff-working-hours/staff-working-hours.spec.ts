import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TranslateModule } from '@ngx-translate/core';
import { AddUserComponent } from '../add-user/add-user.component';
import { StaffListComponent } from '../staff-list/staff-list.component';
import { environment } from '../../../../../environments/environment';
import { User } from '../../../../core/services/user.service';

describe('CEO user working-hours forms', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<AddUserComponent> | ComponentFixture<StaffListComponent>;
  const url = `${environment.apiUrl}/Users`;
  const friday = { dayOfWeek: 5, startTime: '19:00:00', endTime: '21:00:00' };
  const values = { fullName: 'Test Senior', userName: 'test.senior', password: 'Test@1234', gender: 0, birthDate: '1990-01-01', role: 'Senior', workingHours: [friday] };
  const user: User = { id: 'senior-id', fullName: values.fullName, userName: values.userName, roles: ['Senior'], gender: 'Male', birthDate: '1990-01-01T00:00:00', workingHours: [friday] };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AddUserComponent, StaffListComponent, TranslateModule.forRoot()],
      providers: [provideHttpClient(), provideHttpClientTesting()] }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { fixture?.destroy(); http.verify(); });

  function addForm() {
    const created = TestBed.createComponent(AddUserComponent); fixture = created; created.detectChanges();
    return created.componentInstance;
  }
  function editForm() {
    const created = TestBed.createComponent(StaffListComponent); fixture = created; created.detectChanges();
    http.expectOne(`${url}/GetAll`).flush({ value: [user], isSuccess: true });
    created.componentInstance.onEdit(user); created.detectChanges();
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
    expect(component.editForm.get('workingHours')?.value).toEqual([friday]);
    expect(component.editForm.get('birthDate')?.value).toBe('1990-01-01');
    expect(component.editForm.get('gender')?.value).toBe(0);
    expect(fixture.nativeElement.querySelector('[data-weekday="5"]').checked).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-shared-start]').value).toBe('19:00');
    toggleDay(2); toggleDay(5);
    await setTime('[data-shared-start]', '10:00'); await setTime('[data-shared-end]', '18:00');
    const changed = [{ dayOfWeek: 2, startTime: '10:00', endTime: '18:00' }];
    component.onUpdate();
    const request = http.expectOne(`${url}/Update?userId=senior-id`);
    expect(request.request.body.workingHours).toEqual([{ dayOfWeek: 2, startTime: '10:00:00', endTime: '18:00:00' }]);
    expect(user.workingHours).toEqual([friday]);
    request.flush({ ...user, workingHours: changed });
    http.expectOne(`${url}/GetAll`).flush({ value: [{ ...user, workingHours: changed }], isSuccess: true });
    component.onEdit(component.userService.users()[0]);
    expect(component.editForm.get('workingHours')?.value).toEqual(changed);
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
    component.editForm.get('workingHours')?.setValue([friday, { dayOfWeek: 1, startTime: '08:00', endTime: '12:00' }]); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('CEO.STAFF.WORKING_HOURS_CHOOSE_SHARED');
    expect(fixture.nativeElement.querySelector('[data-shared-start]').value).toBe('');
    expect(component.editForm.invalid).toBe(true);
    await setTime('[data-shared-start]', '09:00'); await setTime('[data-shared-end]', '17:00');
    expect(component.editForm.get('workingHours')?.value).toEqual([1, 5].map(dayOfWeek => ({ dayOfWeek, startTime: '09:00', endTime: '17:00' })));
    expect(component.editForm.valid).toBe(true);
  });

  it('preserves Patient creation without a staff schedule', () => {
    const component = addForm(); component.userForm.setValue({ ...values, role: 'Patient', workingHours: [] }); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-staff-working-hours]')).toBeNull();
    component.onSubmit(); const request = http.expectOne(`${url}/Add`);
    expect(request.request.body.workingHours).toEqual([]); request.flush({ ...user, roles: ['Patient'], workingHours: [] });
  });

  it('keeps the selected days and shared range when saving the user fails', () => {
    const component = editForm();
    component.onUpdate();
    const request = http.expectOne(`${url}/Update?userId=senior-id`);
    expect(request.request.body.workingHours).toEqual([friday]);
    request.flush({ detail: 'Unable to save user.' }, { status: 500, statusText: 'Error' });
    expect(component.selectedUser?.id).toBe(user.id); expect(component.updateError).toBeTruthy();
    expect(component.isUpdating).toBe(false);
  });
});
