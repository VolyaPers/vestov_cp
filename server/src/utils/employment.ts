/**
 * Calculate employment-related milestones using a strict 365-day year.
 * - careerYear: 1-based year at company (1 for first 365 days, 2 after 365, etc.)
 * - nextMilestoneYear: the year the user will enter on the next 365-day boundary
 * - nextMilestoneDate: date of the next 365-day boundary
 * - daysUntilNextMilestone: whole days remaining until that boundary (0 if passed)
 */
export function calculateEmploymentMetrics(startDate: string | Date) {
  const start = new Date(startDate)
  if (Number.isNaN(start.getTime())) {
    return {
      careerYear: 1,
      daysAtCompany: 0,
      nextMilestoneYear: 2,
      nextMilestoneDate: new Date(),
      daysUntilNextMilestone: 0,
    }
  }

  const now = new Date()
  const MS_PER_DAY = 1000 * 60 * 60 * 24
  const diffDays = Math.max(0, Math.floor((now.getTime() - start.getTime()) / MS_PER_DAY))

  const completedYears = Math.floor(diffDays / 365)
  const careerYear = completedYears + 1

  const nextMilestoneYear = careerYear + 1
  const nextMilestoneDate = new Date(start.getTime() + careerYear * 365 * MS_PER_DAY)
  const daysUntilNextMilestone = Math.max(
    0,
    Math.ceil((nextMilestoneDate.getTime() - now.getTime()) / MS_PER_DAY)
  )

  return {
    careerYear,
    daysAtCompany: diffDays,
    nextMilestoneYear,
    nextMilestoneDate,
    daysUntilNextMilestone,
  }
}




