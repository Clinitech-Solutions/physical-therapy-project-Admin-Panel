import { clinicDay, ReceptionError } from './reception-api';

export function clinicWeek(instant: Date|string): string {
  const day=new Date(clinicDay(instant)+'T00:00:00Z');
  day.setUTCDate(day.getUTCDate()-((day.getUTCDay()+1)%7));
  return day.toISOString().slice(0,10);
}
/** DatePicker values are clinic wall-clock values, regardless of the device zone. */
export function clinicInstant(wall:Date):Date {
  const desired=Date.UTC(wall.getFullYear(),wall.getMonth(),wall.getDate(),wall.getHours(),wall.getMinutes());
  let result=desired;
  const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  for(let i=0;i<4;i++){
    const parts=formatter.formatToParts(new Date(result));
    const n=(type:string)=>Number(parts.find(p=>p.type===type)?.value);
    const shown=Date.UTC(n('year'),n('month')-1,n('day'),n('hour'),n('minute'));
    if(shown===desired)return new Date(result);
    result+=desired-shown;
  }
  throw new ReceptionError('BOOKING_TIME_REQUIRED','Choose a valid clinic time.');
}
