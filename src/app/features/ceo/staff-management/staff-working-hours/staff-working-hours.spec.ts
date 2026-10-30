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

  it('offers day/time rows while creating staff and saves the user and all hours in one request', () => {
    const component = addForm(); component.userForm.setValue({ ...values, workingHours: [] }); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-staff-working-hours]')).toBeTruthy();
    fixture.nativeElement.querySelector('[data-add-staff-hours]').click(); fixture.detectChanges();
    expect(component.userForm.controls.workingHours.value).toEqual([{ dayOfWeek: null, startTime: '', endTime: '' }]);
    expect(component.userForm.invalid).toBe(true);
    component.userForm.controls.workingHours.setValue([friday, { dayOfWeek: 1, startTime: '08:00', endTime: '12:00' }]);
    component.onSubmit(); component.onSubmit();
    const request = http.expectOne(`${url}/Add`);
    expect(request.request.body.workingHours).toEqual([friday, { dayOfWeek: 1, startTime: '08:00:00', endTime: '12:00:00' }]);
    request.flush(user);
    expect(component.userForm.controls.workingHours.value).toEqual([]);
    http.expectNone(request => request.url.includes('/Bookings/'));
  });

  it('loads existing days/hours into Edit User and saves changed ranges with the profile', () => {
    const component = editForm();
    expect(component.editForm.get('workingHours')?.value).toEqual([friday]);
    expect(component.editForm.get('birthDate')?.value).toBe('1990-01-01');
    expect(component.editForm.get('gender')?.value).toBe(0);
    const changed = [{ dayOfWeek: 2, startTime: '10:00', endTime: '18:00' }];
    component.editForm.get('workingHours')?.setValue(changed); component.onUpdate();
    const request = http.expectOne(`${url}/Update?userId=senior-id`);
    expect(request.request.body.workingHours).toEqual([{ dayOfWeek: 2, startTime: '10:00:00', endTime: '18:00:00' }]);
    expect(user.workingHours).toEqual([friday]);
    request.flush({ ...user, workingHours: changed });
    http.expectOne(`${url}/GetAll`).flush({ value: [{ ...user, workingHours: changed }], isSuccess: true });
    component.onEdit(component.userService.users()[0]);
    expect(component.editForm.get('workingHours')?.value).toEqual(changed);
  });

  it.each([
    [{ dayOfWeek: null, startTime: '09:00', endTime: '10:00' }],
    [{ dayOfWeek: 1, startTime: '20:00', endTime: '09:00' }],
    [{ dayOfWeek: 1, startTime: '08:00', endTime: '12:00' }, { dayOfWeek: 1, startTime: '11:00', endTime: '15:00' }],
  ])('prevents invalid or overlapping working-hour rows from creating a user: %j', (...hours) => {
    const component = addForm(); component.userForm.setValue({ ...values, workingHours: hours });
    component.onSubmit();
    expect(component.userForm.invalid).toBe(true); http.expectNone(`${url}/Add`);
  });

  it('allows removing a saved window and keeps the edit form open if saving fails', () => {
    const component = editForm();
    fixture.nativeElement.querySelector('[aria-label="CEO.STAFF.REMOVE_WORKING_WINDOW"]').click(); fixture.detectChanges();
    expect(component.editForm.get('workingHours')?.value).toEqual([]);
    component.onUpdate();
    const request = http.expectOne(`${url}/Update?userId=senior-id`);
    expect(request.request.body.workingHours).toEqual([]);
    request.flush({ detail: 'Unable to save user.' }, { status: 500, statusText: 'Error' });
    expect(component.selectedUser?.id).toBe(user.id); expect(component.updateError).toBeTruthy();
    expect(component.isUpdating).toBe(false);
  });
});
