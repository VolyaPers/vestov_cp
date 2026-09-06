import { addDays, isoDate, leaveDays, timezoneLocalDate, weekday } from './calendar.js';
export function calculateDays(startDate: string, endDate: string, halfDayStart = false, halfDayEnd = false): number {
  return leaveDays({
    startDate,
    endDate,
    halfDayStart,
    halfDayEnd
  });
}
export function isToday(date: string): boolean {
  return isoDate(date) === timezoneLocalDate();
}
export function isThisWeek(date: string): boolean {
  const today = timezoneLocalDate();
  const start = addDays(today, -weekday(today));
  return date >= start && date <= addDays(start, 6);
}
