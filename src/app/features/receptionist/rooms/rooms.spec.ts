import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { ClinicStateService } from '../../../core/services/state/clinic-state.service';
import { Room } from '../../../core/models/room.model';
import { RoomsComponent } from './rooms';

describe('Room cards rendering', () => {
  let fixture: ComponentFixture<RoomsComponent>;
  const rooms = signal<Room[]>([]);

  beforeEach(async () => {
    rooms.set([]);
    await TestBed.configureTestingModule({
      imports: [RoomsComponent, TranslateModule.forRoot()],
      providers: [
        provideNoopAnimations(), MessageService,
        { provide: ClinicStateService, useValue: {
          rooms, doctors: signal([]), getDoctorName: () => 'Doctor'
        } }
      ]
    }).compileComponents();
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', { RECEPTIONIST: { ROOMS: {
      EMPTY_TITLE: 'No rooms added yet', EMPTY_DESCRIPTION: 'Add a room to start managing clinic availability.',
      UNNAMED_ROOM: 'Unnamed room', UNKNOWN_STATUS: 'Unknown room status'
    } } });
    translate.use('en');
    fixture = TestBed.createComponent(RoomsComponent);
  });

  it('renders every room card with its name and status class', () => {
    rooms.set([
      { id: '1', displayName: 'Room 1', status: 'Occupied', doctorId: null, capacity: 1, currentLoad: 1 },
      { id: '2', displayName: 'Room 2', status: 'Available', doctorId: null, capacity: 1, currentLoad: 0 }
    ]);
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('.room-card');
    expect(cards.length).toBe(2);
    expect(cards[0].textContent).toContain('Room 1');
    expect(cards[0].classList.contains('occupied')).toBe(true);
    expect(cards[1].classList.contains('available')).toBe(true);
  });

  it('keeps rendering cached rooms with numeric or missing statuses', () => {
    rooms.set([
      { id: '1', displayName: 'Legacy room', status: 0, doctorId: null },
      { id: '2', displayName: 'Incomplete room', doctorId: null }
    ] as unknown as Room[]);
    expect(() => fixture.detectChanges()).not.toThrow();
    const cards = fixture.nativeElement.querySelectorAll('.room-card');
    expect(cards.length).toBe(2);
    expect(cards[0].textContent).toContain('Legacy room');
    expect(cards[1].textContent).toContain('Incomplete room');
    expect(cards[0].querySelector('.status-indicator-wrapper').title).toBe('Unknown room status');
  });

  it('shows the empty-state card when no rooms exist', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('No rooms added yet');
    expect(fixture.nativeElement.querySelectorAll('.room-card').length).toBe(0);
  });
});
