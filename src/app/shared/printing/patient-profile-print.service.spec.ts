import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthService } from '../../core/services/auth';
import { PatientProfilePrintService, ProfilePrintOptions } from './patient-profile-print.service';

describe('patient print scope boundaries',()=>{
  let service:PatientProfilePrintService,http:HttpTestingController;
  const hasRole=vi.fn(()=>true);
  const options:ProfilePrintOptions={summary:false,plan:false,sessions:false,clinical:true,financial:false,activity:false,allCourses:true};
  beforeEach(()=>{
    hasRole.mockReturnValue(true);
    TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting(),{provide:AuthService,useValue:{hasRole}}]});
    service=TestBed.inject(PatientProfilePrintService);http=TestBed.inject(HttpTestingController);
  });
  afterEach(()=>http.verify());
  function saved(sessions:number){
    http.expectOne(r=>r.url.endsWith('/Bookings/patients/1/profile')).flush({patientId:1,courses:[{id:3,sessions:Array.from({length:sessions},()=>({})),payments:[],activity:[]}],assessments:[]});
    http.expectOne(r=>r.url.endsWith('/Patients/GetById/1')).flush({id:1,fullName:'Saved patient',phoneNumber:'01000000000'});
  }
  it('applies the cumulative session limit when only clinical history is selected',async()=>{
    const prepared=service.prepare(1,3,options);saved(5001);
    await expect(prepared).rejects.toThrow('narrow the filters');
  });
  it('does not silently switch to all courses when the selected course disappears',async()=>{
    const prepared=service.prepare(1,4,{...options,allCourses:false});saved(1);
    await expect(prepared).rejects.toThrow('Selected course changed');
  });
  it('does not prepare profile data for a role outside the underlying staff read policy',async()=>{
    hasRole.mockReturnValue(false);
    await expect(service.prepare(1,3,options)).rejects.toThrow('Profile access required');
  });
});
