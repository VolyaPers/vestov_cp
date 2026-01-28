import { Router } from 'express'
import { db } from '../db/index.js'
import { teamMembers } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { calculateEmploymentMetrics } from '../utils/employment.js'

const router = Router()

// Helper function to get vacation days based on years
function getVacationDays(yearsAtCompany: number): number {
  if (yearsAtCompany >= 3) return 24
  if (yearsAtCompany >= 2) return 20
  return 16 // Year 1
}

// Helper function to get reimbursement limit based on years
function getReimbursementLimit(yearsAtCompany: number): number {
  if (yearsAtCompany >= 5) return 700
  if (yearsAtCompany >= 4) return 600
  if (yearsAtCompany >= 3) return 500
  if (yearsAtCompany >= 2) return 400
  return 300 // 1 year
}

// GET /api/roadmap - Get employee roadmap data
router.get('/', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    // Try to get team member by teamMemberId first (more reliable)
    let member
    if ((req.user as any).teamMemberId) {
      try {
        const [foundMember] = await db
          .select()
          .from(teamMembers)
          .where(eq(teamMembers.id, (req.user as any).teamMemberId))
          .limit(1)
        member = foundMember
      } catch (error) {
        console.error('[GET /roadmap] Error fetching by teamMemberId:', error)
      }
    }

    // Fallback to email lookup if teamMemberId didn't work
    if (!member) {
      const members = await db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.email, req.user.email!))
      member = members[0]
    }

    if (!member) {
      return res.status(404).json({ error: 'Team member not found' })
    }

    const employment = calculateEmploymentMetrics(member.startDate)

    const yearsAtCompany = employment.careerYear
    const currentVacationDays = getVacationDays(yearsAtCompany)
    const currentReimbursementLimit = getReimbursementLimit(yearsAtCompany)

    res.json({
      currentYear: new Date().getFullYear(),
      startDate: member.startDate,
      yearsAtCompany,
      currentVacationDays,
      currentReimbursementLimit,
      nextMilestoneYear: employment.nextMilestoneYear,
      daysUntilNextMilestone: employment.daysUntilNextMilestone,
      nextMilestoneDate: employment.nextMilestoneDate
    })
  } catch (error) {
    console.error('Error fetching roadmap data:', error)
    res.status(500).json({ error: 'Failed to fetch roadmap data' })
  }
})

export default router
