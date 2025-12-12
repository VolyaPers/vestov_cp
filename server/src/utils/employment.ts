const MS_PER_DAY = 1000 * 60 * 60 * 24
const YEAR_DAYS = 365

const toUtcMidnight = (date: Date) =>
  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())

export function calculateEmploymentMetrics(startDateInput: string | Date) {
  const start = new Date(startDateInput)
  const now = new Date()

  const diffDays = Math.floor((toUtcMidnight(now) - toUtcMidnight(start)) / MS_PER_DAY)
  const daysSinceStart = Math.max(0, diffDays)

  const careerYear = Math.floor(daysSinceStart / YEAR_DAYS) + 1
  const daysIntoCurrentYear = daysSinceStart % YEAR_DAYS
  const daysUntilNextMilestone = YEAR_DAYS - daysIntoCurrentYear
  const nextMilestoneYear = careerYear + 1

  const nextMilestoneDate = new Date(
    toUtcMidnight(start) + careerYear * YEAR_DAYS * MS_PER_DAY
  )

  return {
    careerYear,
    daysSinceStart,
    daysIntoCurrentYear,
    daysUntilNextMilestone,
    nextMilestoneYear,
    nextMilestoneDate: nextMilestoneDate.toISOString().split('T')[0]
  }
}

