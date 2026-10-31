import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController,provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { RoomService } from '../room.service';
import { environment } from '../../../../environments/environment';

describe('Room persistence migration away from browser storage',()=>{
  let http:HttpTestingController;
  beforeEach(()=>{TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting()]});http=TestBed.inject(HttpTestingController);});
  afterEach(()=>{http.verify();localStorage.removeItem('clinic_rooms');});
  it.each(['[]','[{"id":"local-only-room"}]','{invalid json'])('ignores the legacy browser cache %s',cached=>{
    localStorage.setItem('clinic_rooms',cached);
    const service=TestBed.inject(RoomService);service.load();http.expectOne(environment.apiUrl+'/Rooms').flush([]);
    expect(service.rooms()).toEqual([]);
    expect(localStorage.getItem('clinic_rooms')).toBe(cached);
  });
  it('reloads persisted server records after creation without inventing the returned ID',async()=>{
    const service=TestBed.inject(RoomService);
    const save=firstValueFrom(service.create({name:'Therapy',capacity:2,isActive:true}));
    http.expectOne(environment.apiUrl+'/Rooms').flush(null);await save;
    expect(service.rooms()).toEqual([]);
    service.load();http.expectOne(environment.apiUrl+'/Rooms').flush([{id:37,name:'Therapy',capacity:2,isActive:true}]);
    expect(service.rooms()[0].id).toBe(37);
    expect(localStorage.getItem('clinic_rooms')).toBeNull();
  });
});
