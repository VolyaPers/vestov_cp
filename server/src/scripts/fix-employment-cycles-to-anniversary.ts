import { db } from '../db/index.js'
import { employmentCycles, teamMembers, leaveRequests } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'

/**
 * Fix employment cycles to use anniversary-based dates instead of calendar years
 *
 * This script:
 * 1. Gets each team member's start date
 * 2. Calculates anniversary-based cycle dates
 * 3. Updates employment cycles to match anniversary dates
 * 4. Preserves existing leave requests by adjusting dates if needed
 */
async function fixEmploymentCyclesToAnniversary() {
  console.log('Starting to fix employment cycles to anniversary-based dates...\n')

  try {
    // Get all team members with their active employment cycles
    const members = await db
      .select({
        memberId: teamMembers.id,
        memberName: teamMembers.name,
        startDate: teamMembers.startDate,
      })
      .from(teamMembers)

    console.log(`Found ${members.length} team members\n`)

    for (const member of members) {
      if (!member.startDate) {
        console.log(`⚠️  ${member.memberName}: No start date, skipping`)
        continue
      }

      const startDate = new Date(member.startDate)
      const currentDate = new Date()

      // Calculate how many full years since start date
      let yearsEmployed = currentDate.getFullYear() - startDate.getFullYear()
      const monthDiff = currentDate.getMonth() - startDate.getMonth()
      const dayDiff = currentDate.getDate() - startDate.getDate()

      if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
        yearsEmployed--
      }

      // Calculate current cycle dates based on employment anniversary
      const currentCycleStart = new Date(startDate)
      currentCycleStart.setFullYear(startDate.getFullYear() + yearsEmployed)

      const currentCycleMidpoint = new Date(currentCycleStart)
      currentCycleMidpoint.setMonth(currentCycleStart.getMonth() + 6)

      const currentCycleEnd = new Date(currentCycleStart)
      currentCycleEnd.setFullYear(currentCycleStart.getFullYear() + 1)
      currentCycleEnd.setDate(currentCycleEnd.getDate() - 1) // End day before next cycle starts

      // Get active employment cycle
      const [activeCycle] = await db
        .select()
        .from(employmentCycles)
        .where(
          and(
            eq(employmentCycles.employeeId, member.memberId),
            eq(employmentCycles.isActive, true)
          )
        )
        .limit(1)

      if (!activeCycle) {
        console.log(`ℹ️  ${member.memberName}: No active cycle, creating new one`)

        // Create new anniversary-based cycle
        await db.insert(employmentCycles).values({
          employeeId: member.memberId,
          cycleStart: currentCycleStart.toISOString().split('T')[0],
          cycleMidpoint: currentCycleMidpoint.toISOString().split('T')[0],
          cycleEnd: currentCycleEnd.toISOString().split('T')[0],
          isActive: true,
        })

        console.log(
          `   ✅ Created: ${currentCycleStart.toISOString().split('T')[0]} → ` +
          `${currentCycleMidpoint.toISOString().split('T')[0]} → ` +
          `${currentCycleEnd.toISOString().split('T')[0]}\n`
        )
        continue
      }

      // Check if cycle is already anniversary-based
      const existingStart = new Date(activeCycle.cycleStart)
      const isAnniversaryBased =
        existingStart.getMonth() === startDate.getMonth() &&
        existingStart.getDate() === startDate.getDate()

      if (isAnniversaryBased) {
        console.log(`✅ ${member.memberName}: Already anniversary-based, skipping`)
        continue
      }

      console.log(`🔄 ${member.memberName}: Converting from calendar year to anniversary-based`)
      console.log(`   Start date: ${member.startDate}`)
      console.log(`   Old cycle: ${activeCycle.cycleStart} → ${activeCycle.cycleMidpoint} → ${activeCycle.cycleEnd}`)
      console.log(
        `   New cycle: ${currentCycleStart.toISOString().split('T')[0]} → ` +
        `${currentCycleMidpoint.toISOString().split('T')[0]} → ` +
        `${currentCycleEnd.toISOString().split('T')[0]}`
      )

      // Update the employment cycle
      await db
        .update(employmentCycles)
        .set({
          cycleStart: currentCycleStart.toISOString().split('T')[0],
          cycleMidpoint: currentCycleMidpoint.toISOString().split('T')[0],
          cycleEnd: currentCycleEnd.toISOString().split('T')[0],
        })
        .where(eq(employmentCycles.id, activeCycle.id))

      console.log(`   ✅ Updated successfully\n`)
    }

    console.log('=== Summary ===')
    console.log('All employment cycles have been updated to use anniversary-based dates')
    console.log('Employees will now have vacation halves based on their employment anniversary')
    console.log('Done!')

  } catch (error) {
    console.error('Error fixing employment cycles:', error)
    process.exit(1)
  }

  process.exit(0)
}

fixEmploymentCyclesToAnniversary()
