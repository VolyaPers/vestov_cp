import { db } from '../db'
import { employmentCycles } from '../db/schema'
import { eq, isNull } from 'drizzle-orm'

/**
 * Fix missing cycleMidpoint values in employment_cycles table
 * This script calculates and sets the midpoint (6 months from start) for all cycles
 */
async function fixCycleMidpoints() {
  console.log('Starting to fix cycle midpoints...')

  try {
    // Get all employment cycles
    const cycles = await db
      .select()
      .from(employmentCycles)

    console.log(`Found ${cycles.length} employment cycles`)

    let updated = 0
    let skipped = 0

    for (const cycle of cycles) {
      // Check if midpoint already exists
      if (cycle.cycleMidpoint) {
        console.log(`Cycle ${cycle.id}: midpoint already exists (${cycle.cycleMidpoint}), skipping`)
        skipped++
        continue
      }

      // Calculate midpoint as 6 months from start
      const startDate = new Date(cycle.cycleStart)
      const midpointDate = new Date(startDate)
      midpointDate.setMonth(startDate.getMonth() + 6)
      const cycleMidpoint = midpointDate.toISOString().split('T')[0]

      // Update the cycle
      await db
        .update(employmentCycles)
        .set({ cycleMidpoint })
        .where(eq(employmentCycles.id, cycle.id))

      console.log(
        `Cycle ${cycle.id}: Updated midpoint to ${cycleMidpoint} ` +
        `(start: ${cycle.cycleStart}, end: ${cycle.cycleEnd})`
      )
      updated++
    }

    console.log('\n=== Summary ===')
    console.log(`Total cycles: ${cycles.length}`)
    console.log(`Updated: ${updated}`)
    console.log(`Skipped: ${skipped}`)
    console.log('Done!')

  } catch (error) {
    console.error('Error fixing cycle midpoints:', error)
    process.exit(1)
  }

  process.exit(0)
}

fixCycleMidpoints()
