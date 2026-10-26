import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MessageService } from 'primeng/api';
import { BookingsComponent } from './bookings';
import { PatientService } from '../../../core/services/patient.service';
import { ClinicianService } from '../../../core/services/clinician.service';

describe('Bookings backend workflow presentation',()=>{
  let component:BookingsComponent;
  beforeEach(()=>{
    TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting(),MessageService]});
    component=TestBed.runInInjectionContext(()=>new BookingsComponent());
  });
  it('does not infer a new-patient or insurance-approval gate from an empty cache',()=>{
    component.selectedPatientId='1';
    expect(component.isNewPatient).toBe(false);expect(component.isInsurancePending).toBe(false);
  });
  it('keeps real directory IDs, including an unidentified clinician gender',()=>{
    TestBed.inject(PatientService).patients.set([{id:'1'} as never]);
    TestBed.inject(ClinicianService).clinicians.set([{id:'doctor-guid',name:'Doctor',roles:['Doctor']}]);
    component.selectedPatientId='1';
    expect(component.filteredDoctors.map(d=>d.id)).toEqual(['doctor-guid']);
    expect(component.getDoctorGender('doctor-guid')).toBe('');
  });
  it('never manufactures a nearest slot from room records',()=>{
    const spy=vi.spyOn(component.messageService,'add');
    component.handleWalkInNearestSlot();
    expect(component.selectedDoctorId).toBe('');expect(component.selectedRoomId).toBe('');
    expect(spy.mock.lastCall?.[0].severity).toBe('warn');
  });
  it('does not simulate staff absence persistence',()=>{
    const spy=vi.spyOn(component.messageService,'add');
    component.confirmAbsence();
    expect(spy.mock.lastCall?.[0].severity).toBe('warn');
  });
  it('rejects recurring-date inputs that cannot advance',()=>{
    component.planSessionCount=1;component.selectedDays=[99];
    expect(component.generateBulkDates()).toEqual([]);
    component.selectedDays=[0];component.planSessionCount=1.5;
    expect(component.generateBulkDates()).toEqual([]);
  });
  it('shows only backend appointments and never clinic-state session fallbacks',()=>{
    expect(component.todaySessions).toEqual([]);
    expect(component.getSessionBadge({id:1} as never)).toBe('');
  });
});
