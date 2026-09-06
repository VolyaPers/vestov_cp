import { addDays, leaveDaySegments, weekday, type LeaveDates } from '../utils/calendar.js';

export const SHORT_SICK_LEAVE_REASON = 'Automatically approved: sick leave episode of up to 2 working days';

type SickRequest = LeaveDates & { id?: number; leaveTypeId: number; status: string; archivedAt?: unknown };

function nextWorkingDate(date: string): string {
  let next = addDays(date, 1);
  while (weekday(next) === 0 || weekday(next) === 6) next = addDays(next, 1);
  return next;
}

/** Adjacent requests, including across weekends and leave-type aliases, form one sick episode. */
export function sickEpisodeDays(dates: LeaveDates, requests: SickRequest[], sickTypeIds: number[], excludeRequestId?: number): number {
  const ownDays = leaveDaySegments(dates);
  if (!ownDays.length) return 0;
  const pending = requests.filter(request => request.id !== excludeRequestId && !request.archivedAt &&
    ['pending', 'approved'].includes(request.status) && sickTypeIds.includes(request.leaveTypeId))
    .map(request => leaveDaySegments(request)).filter(days => days.length);
  const joined = [...ownDays];
  let start = ownDays[0].date;
  let end = ownDays[ownDays.length - 1].date;
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (let index = pending.length - 1; index >= 0; index--) {
      const days = pending[index];
      const first = days[0].date;
      const last = days[days.length - 1].date;
      if (first > nextWorkingDate(end) || nextWorkingDate(last) < start) continue;
      joined.push(...days);
      start = first < start ? first : start;
      end = last > end ? last : end;
      pending.splice(index, 1);
      expanded = true;
    }
  }
  const slots = new Set<string>();
  for (const day of joined) for (let half = day.startHalf; half < day.endHalf; half++) slots.add(`${day.date}:${half}`);
  return slots.size / 2;
}
