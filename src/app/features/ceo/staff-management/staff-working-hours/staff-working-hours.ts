import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { StaffWorkingHours, validStaffWorkingHours, validStaffWorkingTimeRange } from '../../../../core/models/staff-working-hours.model';

@Component({
  selector: 'app-staff-working-hours',
  standalone: true,
  imports: [FormsModule, TranslateModule],
  templateUrl: './staff-working-hours.html',
  styleUrl: './staff-working-hours.css',
})
export class StaffWorkingHoursComponent implements OnChanges {
  private static nextId = 0;
  readonly id = `staff-hours-${StaffWorkingHoursComponent.nextId++}`;
  @Input() hours: StaffWorkingHours[] = [];
  @Input() disabled = false;
  @Input() showErrors = false;
  @Output() hoursChange = new EventEmitter<StaffWorkingHours[]>();
  private readonly translate = inject(TranslateService);
  readonly days = [6, 0, 1, 2, 3, 4, 5];
  selectedDays: number[] = [];
  startTime = '';
  endTime = '';
  daysTouched = false;
  startTouched = false;
  endTouched = false;
  differentSavedRanges = false;
  private lastEmitted: StaffWorkingHours[] | null = null;

  ngOnChanges(changes: SimpleChanges) {
    if (!changes['hours'] || this.hours === this.lastEmitted) return;
    this.selectedDays = this.days.filter(day => this.hours.some(window => window.dayOfWeek === day));
    this.differentSavedRanges = this.hours.length > 0 && !validStaffWorkingHours(this.hours);
    const inputTime = (time = '') => time.length === 8 && time.endsWith(':00') ? time.slice(0, 5) : time;
    this.startTime = this.differentSavedRanges ? '' : inputTime(this.hours[0]?.startTime);
    this.endTime = this.differentSavedRanges ? '' : inputTime(this.hours[0]?.endTime);
    this.daysTouched = this.startTouched = this.endTouched = false;
  }
  get daysInvalid() { return !this.selectedDays.length && (this.showErrors || this.daysTouched); }
  get startRequired() { return !this.startTime && (this.showErrors || this.startTouched); }
  get endRequired() { return !this.endTime && (this.showErrors || this.endTouched); }
  get rangeInvalid() {
    return !!this.startTime && !!this.endTime && !validStaffWorkingTimeRange(this.startTime, this.endTime) && (this.showErrors || this.startTouched || this.endTouched);
  }
  dayLabel(day: number, short = false): string {
    return new Date(Date.UTC(2023, 0, 1 + day)).toLocaleDateString(this.translate.currentLang === 'ar' ? 'ar-EG' : 'en-US', { weekday: short ? 'short' : 'long', timeZone: 'UTC' });
  }
  toggleDay(day: number, event: Event) {
    if (this.disabled) return;
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedDays = this.days.filter(value => value === day ? checked : this.selectedDays.includes(value));
    this.daysTouched = true;
    this.emitSchedule();
  }
  changeTime(field: 'startTime' | 'endTime', value: string) {
    if (this.disabled) return;
    this[field] = value;
    if (field === 'startTime') this.startTouched = true; else this.endTouched = true;
    this.emitSchedule();
  }
  private emitSchedule() {
    this.differentSavedRanges = false;
    this.lastEmitted = this.selectedDays.map(dayOfWeek => ({ dayOfWeek, startTime: this.startTime, endTime: this.endTime }));
    this.hoursChange.emit(this.lastEmitted);
  }
}
