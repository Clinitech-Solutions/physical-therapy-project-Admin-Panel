import { TestBed } from "@angular/core/testing";
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { AuthService } from "./auth";

describe("AuthService", () => {
  let service: AuthService;

  beforeEach(() => {
    localStorage.removeItem('mediqova-token');
    TestBed.configureTestingModule({providers:[provideRouter([]),provideHttpClient(),provideHttpClientTesting()]});
    service = TestBed.inject(AuthService);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });
  afterEach(()=>localStorage.removeItem('mediqova-token'));
  function loadRoles(roles:string[]){localStorage.setItem('mediqova-token','unit.'+btoa(JSON.stringify({sub:'unit-user',roles}))+'.unit');service.initAuth();}
  it('keeps CEO navigation for a supervisor with additional clinical roles without changing the role set',()=>{loadRoles(['Doctor','Ceo']);expect(service.currentRole()).toBe('Ceo');expect(service.hasRole('Doctor')).toBe(true);expect(service.currentUser()?.roles).toEqual(['Doctor','Ceo']);});
  it('keeps a Senior workspace available when Doctor coverage is also authorized',()=>{loadRoles(['Doctor','Senior']);expect(service.currentRole()).toBe('Senior');expect(service.hasRole('Doctor')).toBe(true);});
});
