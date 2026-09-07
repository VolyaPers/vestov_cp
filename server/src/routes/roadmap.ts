import { reimbursementPolicy, benefitFactor } from '../services/employmentPolicy.js';
import { Router } from 'express';
import { calculateEmploymentMetrics } from '../utils/employment.js';
import { calculateVacationBalance, configuredAllocation, isVacationType, loadLeaveContext } from '../utils/vacationBalanceCalculator.js';
import { timezoneLocalDate } from '../utils/calendar.js';
import { requireAuth } from '../middleware/auth.js';
import { resolveEmployeeId } from '../services/access.js';
const router = Router();
router.get('/', requireAuth, async (req, res) => {
  try {
    const employeeId = await resolveEmployeeId(req.user!);
    if (!employeeId) return res.status(403).json({
      error: 'Linked employee profile required'
    });
    const context = await loadLeaveContext(employeeId),
      today = timezoneLocalDate(new Date(), context.member.timezone);
    const employment = calculateEmploymentMetrics(context.member.startDate, new Date(`${today}T12:00:00Z`));
    const balance = await calculateVacationBalance(employeeId),
      type = context.types.find((t: any) => isVacationType(t.name));
    res.json({
      employmentType: context.member.employmentType,
      benefitFactor: benefitFactor(context.member.employmentType),
      currentYear: Number(today.slice(0, 4)),
      startDate: context.member.startDate,
      yearsAtCompany: employment.careerYear,
      currentVacationDays: balance?.totalAllocated || 0,
      currentReimbursementLimit: reimbursementPolicy(employment.careerYear, context.member.employmentType).yearlyLimit,
      nextMilestoneYear: employment.nextMilestoneYear,
      daysUntilNextMilestone: employment.daysUntilNextMilestone,
      nextMilestoneDate: employment.nextMilestoneDate,
      milestones: [1, 2, 3, 4, 5].map(year => ({
        year,
        vacationDays: type ? configuredAllocation(context, type, year) * benefitFactor(context.member.employmentType) : 0,
        reimbursementLimit: reimbursementPolicy(year, context.member.employmentType).yearlyLimit
      }))
    });
  } catch (error) {
    console.error('Roadmap failed', error);
    res.status(500).json({
      error: 'Failed to load roadmap'
    });
  }
});
export default router;
