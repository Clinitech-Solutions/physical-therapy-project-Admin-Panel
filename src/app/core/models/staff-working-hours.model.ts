export interface StaffWorkingHours {
  dayOfWeek: number | null;
  startTime: string;
  endTime: string;
}

const clock = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
const seconds = (time: string) => time.split(':').reduce((value, part, index) => value + Number(part) * [3600, 60, 1][index], 0);
export function validStaffWorkingHours(hours: StaffWorkingHours[]): boolean {
  return hours.length <= 28 && hours.every((window, index) =>
    window.dayOfWeek !== null && Number.isInteger(window.dayOfWeek) && window.dayOfWeek >= 0 && window.dayOfWeek <= 6 &&
    clock.test(window.startTime) && clock.test(window.endTime) && seconds(window.startTime) < seconds(window.endTime) &&
    !hours.some((other, otherIndex) => otherIndex !== index && other.dayOfWeek === window.dayOfWeek &&
      clock.test(other.startTime) && clock.test(other.endTime) && seconds(other.startTime) < seconds(window.endTime) && seconds(window.startTime) < seconds(other.endTime)));
}

export function serializeStaffWorkingHours(hours: StaffWorkingHours[]): StaffWorkingHours[] {
  return hours.map(window => ({ ...window,
    startTime: window.startTime.length === 5 ? `${window.startTime}:00` : window.startTime,
    endTime: window.endTime.length === 5 ? `${window.endTime}:00` : window.endTime,
  }));
}
