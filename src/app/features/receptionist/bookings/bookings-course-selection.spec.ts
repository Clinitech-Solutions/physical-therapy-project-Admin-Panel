import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { BookingsComponent } from './bookings';
import { BookingContext } from '../../../core/models/booking.model';

describe('Booking eligible course selection',()=>{
 let component:BookingsComponent;
 beforeEach(()=>{
  sessionStorage.clear();
  TestBed.configureTestingModule({imports:[TranslateModule.forRoot()],providers:[provideHttpClient(),provideHttpClientTesting(),provideRouter([]),MessageService]});
  component=TestBed.runInInjectionContext(()=>new BookingsComponent());
  vi.spyOn(component,'refreshRoomAvailability').mockImplementation(()=>{});
  vi.spyOn(component,'loadEligibleClinicians').mockResolvedValue();
 });
 afterEach(()=>TestBed.inject(HttpTestingController).verify());
 const context=(firstRemaining:number)=>({patientId:1,patientName:'Two courses',hasCompletedAssessment:true,isInsurance:false,plans:[
  {id:10,plannedSessions:2,remainingSessions:firstRemaining,frequencyPerWeek:2,doctorId:'doctor'},
  {id:20,plannedSessions:3,remainingSessions:2,frequencyPerWeek:3,doctorId:'doctor'}
 ]} as BookingContext);
 it('keeps booking usable when a fully allocated course leaves one other eligible course',async()=>{
  vi.spyOn(component.bookingApi,'context').mockReturnValue(of(context(0)));
  await component.onPatientChange('1');
  expect(component.patientPlans.map(p=>p.id)).toEqual([20]);expect(component.selectedPlanId).toBe(20);
  expect(component.chosenPlan?.plannedSessions).toBe(3);expect(component.maxBookingSessions).toBe(2);
  expect(component.loadEligibleClinicians).toHaveBeenCalledOnce();expect(component.refreshRoomAvailability).toHaveBeenCalled();
 });
 it('requires an explicit choice when both saved courses are still eligible',async()=>{
  vi.spyOn(component.bookingApi,'context').mockReturnValue(of(context(1)));
  await component.onPatientChange('1');
  expect(component.patientPlans).toHaveLength(2);expect(component.selectedPlanId).toBeNull();expect(component.chosenPlan).toBeUndefined();
  expect(component.loadEligibleClinicians).not.toHaveBeenCalled();expect(component.canPreview).toBe(false);
 });
});
