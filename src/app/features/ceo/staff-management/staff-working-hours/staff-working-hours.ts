import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { inject } from '@angular/core';
import { StaffWorkingHours, validStaffWorkingHours } from '../../../../core/models/staff-working-hours.model';

@Component({
  selector: 'app-staff-working-hours',
  standalone: true,
  imports: [FormsModule, TranslateModule],
  templateUrl: './staff-working-hours.html',
})
export class StaffWorkingHoursComponent {
  @Input() hours: StaffWorkingHours[] = [];
  @Input() disabled = false;
  @Output() hoursChange = new EventEmitter<StaffWorkingHours[]>();
  private readonly translate = inject(TranslateService);
  readonly days = [6, 0, 1, 2, 3, 4, 5];
  get valid() { return validStaffWorkingHours(this.hours); }
  dayLabel(day: number): string {
    return new Date(Date.UTC(2023, 0, 1 + day)).toLocaleDateString(this.translate.currentLang === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'long', timeZone: 'UTC' });
  }
  add() {
    if (!this.disabled && this.hours.length < 28) this.hoursChange.emit([...this.hours, { dayOfWeek: null, startTime: '', endTime: '' }]);
  }
  change(index: number, field: keyof StaffWorkingHours, value: number | string | null) {
    if (!this.disabled) this.hoursChange.emit(this.hours.map((window, position) => position === index ? { ...window, [field]: value } : window));
  }
  remove(index: number) { if (!this.disabled) this.hoursChange.emit(this.hours.filter((_, position) => position !== index)); }
}
