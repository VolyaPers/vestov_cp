import { Router } from 'express'
import { db } from '../db/index.js'
import { teamMembers } from '../db/schema.js'
import { eq } from 'drizzle-orm'

const router = Router()

// Helper function to calculate years at company (completed years)
function calculateYearsAtCompany(startDate: string | Date): number {
  const start = new Date(startDate)
  const now = new Date()
  const years = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  return Math.max(1, Math.floor(years))
}

// Helper function to get vacation days based on years
function getVacationDays(yearsAtCompany: number): number {
  if (yearsAtCompany >= 3) return 24
  if (yearsAtCompany >= 2) return 20
  return 16 // 1 year
}

// Helper function to get reimbursement limit based on years
function getReimbursementLimit(yearsAtCompany: number): number {
  if (yearsAtCompany >= 5) return 700
  if (yearsAtCompany >= 4) return 600
  if (yearsAtCompany >= 3) return 500
  if (yearsAtCompany >= 2) return 400
  return 300 // 1 year
}

// Helper function to calculate next milestone date
function getNextMilestoneInfo(startDate: string | Date) {
  const start = new Date(startDate)
  const now = new Date()

  // Calculate current completed years
  const years = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  const completedYears = Math.max(1, Math.floor(years))

  // The next milestone is the next completed year
  // e.g., if you've completed 4 years, your next milestone is Year 5
  const nextMilestoneYear = completedYears + 1

  // Find the next anniversary date (when they'll reach the next milestone)
  let nextAnniversary = new Date(start)
  nextAnniversary.setFullYear(now.getFullYear())

  // If this year's anniversary has passed, use next year's
  if (nextAnniversary <= now) {
    nextAnniversary.setFullYear(now.getFullYear() + 1)
  }

  // Calculate days until next milestone
  const daysUntilMilestone = Math.ceil(
    (nextAnniversary.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  )

  return {
    nextMilestoneDate: nextAnniversary.toISOString().split('T')[0],
    daysUntilNextMilestone: daysUntilMilestone,
    nextMilestoneYear: nextMilestoneYear
  }
}

// GET /api/roadmap - Get employee roadmap data
router.get('/', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    // Get team member by email
    const members = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.email, req.user.email!))

    const member = members[0]

    if (!member) {
      return res.status(404).json({ error: 'Team member not found' })
    }

    const yearsAtCompany = calculateYearsAtCompany(member.startDate)
    const currentVacationDays = getVacationDays(yearsAtCompany)
    const currentReimbursementLimit = getReimbursementLimit(yearsAtCompany)
    const milestoneInfo = getNextMilestoneInfo(member.startDate)

    res.json({
      currentYear: new Date().getFullYear(),
      startDate: member.startDate,
      yearsAtCompany,
      currentVacationDays,
      currentReimbursementLimit,
      ...milestoneInfo
    })
  } catch (error) {
    console.error('Error fetching roadmap data:', error)
    res.status(500).json({ error: 'Failed to fetch roadmap data' })
  }
})

export default router
