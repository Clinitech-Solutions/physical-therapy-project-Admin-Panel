import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { RoomService } from '../../../core/services/room.service';
import { RoomRecord } from '../../../core/models/room-api.model';
import { RoomsComponent } from './rooms';

describe('Backend room cards',()=>{
  let fixture:ComponentFixture<RoomsComponent>;
  const rooms=signal<RoomRecord[]>([]);
  const error=signal<string|null>(null);
  const service={rooms,error,loading:signal(false),mutation:{busy:signal(false),uncertain:signal(false)},load:vi.fn()};
  beforeEach(async()=>{
    rooms.set([]);error.set(null);
    await TestBed.configureTestingModule({imports:[RoomsComponent,TranslateModule.forRoot()],providers:[provideNoopAnimations(),MessageService,{provide:RoomService,useValue:service}]}).compileComponents();
    TestBed.inject(TranslateService).setTranslation('en',{RECEPTIONIST:{ROOMS:{EMPTY_TITLE:'No rooms added yet'}}});
    TestBed.inject(TranslateService).use('en');
    fixture=TestBed.createComponent(RoomsComponent);
  });
  it('renders server record names without claiming room availability or occupancy',()=>{
    rooms.set([{id:1,name:'Therapy room',capacity:2,isActive:true}]);fixture.detectChanges();
    const card=fixture.nativeElement.querySelector('.room-card');
    expect(card.textContent).toContain('Therapy room');
    expect(card.classList.contains('occupied')).toBe(false);expect(card.classList.contains('available')).toBe(false);
  });
  it('shows failures and retries instead of reporting an empty successful floor plan',()=>{
    error.set('Request failed');fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Request failed');
    expect(fixture.nativeElement.querySelector('.room-card')).toBeNull();
  });
  it('shows an empty state only after a successful empty list',()=>{
    fixture.detectChanges();expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('No rooms added yet');
  });
});
