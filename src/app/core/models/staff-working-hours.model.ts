export interface StaffWorkingHours {
  dayOfWeek: number | null;
  startTime: string;
  endTime: string;
}

const clock = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
const seconds = (time: string) => time.split(':').reduce((value, part, index) => value + Number(part) * [3600, 60, 1][index], 0);
export function validStaffWorkingTimeRange(start: string, end: string): boolean {
  return clock.test(start) && clock.test(end) && seconds(start) < seconds(end);
}
export function validStaffWorkingHours(hours: StaffWorkingHours[]): boolean {
  const first = hours[0];
  return hours.length > 0 && hours.length <= 7 && hours.every((window, index) =>
    window.dayOfWeek !== null && Number.isInteger(window.dayOfWeek) && window.dayOfWeek >= 0 && window.dayOfWeek <= 6 &&
    validStaffWorkingTimeRange(window.startTime, window.endTime) &&
    seconds(window.startTime) === seconds(first.startTime) && seconds(window.endTime) === seconds(first.endTime) &&
    !hours.some((other, otherIndex) => otherIndex !== index && other.dayOfWeek === window.dayOfWeek));
}

export function serializeStaffWorkingHours(hours: StaffWorkingHours[]): StaffWorkingHours[] {
  if (!hours.length) return []; // Patient accounts have no staff schedule.
  if (!validStaffWorkingHours(hours)) throw new Error('Select working days and one valid shared time range.');
  const { startTime, endTime } = hours[0];
  return hours.map(window => ({ dayOfWeek: window.dayOfWeek,
    startTime: startTime.length === 5 ? `${startTime}:00` : startTime,
    endTime: endTime.length === 5 ? `${endTime}:00` : endTime,
  }));
}
