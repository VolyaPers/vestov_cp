import { addDays, daysBetween, employmentCycleForDate, isoDate } from './calendar.js';
/** Benefits and cycles use the same employment anniversary, including leap years. */
export function calculateEmploymentMetrics(startDate: string | Date, currentDate: Date = new Date()) {
  const start = isoDate(startDate);
  const today = isoDate(currentDate);
  if (today < start) return {
    careerYear: 1,
    daysAtCompany: 0,
    nextMilestoneYear: 2,
    nextMilestoneDate: new Date(`${addDays(employmentCycleForDate(start, start).cycleEnd, 1)}T00:00:00Z`),
    daysUntilNextMilestone: daysBetween(today, addDays(employmentCycleForDate(start, start).cycleEnd, 1))
  };
  const cycle = employmentCycleForDate(start, today);
  const next = addDays(cycle.cycleEnd, 1);
  return {
    careerYear: cycle.careerYear,
    daysAtCompany: daysBetween(start, today),
    nextMilestoneYear: cycle.careerYear + 1,
    nextMilestoneDate: new Date(`${next}T00:00:00Z`),
    daysUntilNextMilestone: daysBetween(today, next)
  };
}
