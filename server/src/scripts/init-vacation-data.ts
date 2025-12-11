import { db } from '../db/index.js'
import { leaveTypes, employmentCycles, leaveBalances, teamMembers } from '../db/schema.js'
import { eq } from 'drizzle-orm'

async function initVacationData() {
  try {
    console.log('Initializing vacation system data...')
    
    // 1. Create default leave types if they don't exist
    const existingTypes = await db.select().from(leaveTypes)
    
    if (existingTypes.length === 0) {
      console.log('Creating default leave types...')
      
      await db.insert(leaveTypes).values([
        {
          name: 'Vacation',
          isDeductible: true,
          halfDaySupported: true,
        },
        {
          name: 'Sick Leave',
          isDeductible: true,
          halfDaySupported: true,
        },
        {
          name: 'Personal Leave',
          isDeductible: true,
          halfDaySupported: true,
        },
        {
          name: 'Public Holiday',
          isDeductible: false,
          halfDaySupported: false,
        },
      ])
      
      console.log('✓ Leave types created')
    } else {
      console.log('✓ Leave types already exist')
    }
    
    // 2. Initialize employment cycles for existing team members
    const members = await db.select().from(teamMembers)
    const leaveTypeRecords = await db.select().from(leaveTypes)
    
    console.log(`Found ${members.length} team members`)
    
    for (const member of members) {
      // Check if member has an active cycle
      const existingCycle = await db
        .select()
        .from(employmentCycles)
        .where(eq(employmentCycles.employeeId, member.id))
        .limit(1)
      
      if (existingCycle.length === 0) {
        console.log(`Creating employment cycle for ${member.name}...`)
        
        // Create a cycle for the current year
        const currentYear = new Date().getFullYear()
        const cycleStart = `${currentYear}-01-01`
        const cycleEnd = `${currentYear}-12-31`
        
        const [cycle] = await db
          .insert(employmentCycles)
          .values({
            employeeId: member.id,
            cycleStart,
            cycleEnd,
            isActive: true,
          })
          .returning()
        
        // Create default balances for each leave type
        for (const leaveType of leaveTypeRecords) {
          // Default allocations based on leave type
          let defaultDays = '0'
          if (leaveType.name === 'Vacation') {
            defaultDays = '30' // 30 days vacation
          } else if (leaveType.name === 'Sick Leave') {
            defaultDays = '10' // 10 days sick leave
          } else if (leaveType.name === 'Personal Leave') {
            defaultDays = '5' // 5 days personal leave
          }
          
          await db.insert(leaveBalances).values({
            employeeId: member.id,
            employmentCycleId: cycle.id,
            leaveTypeId: leaveType.id,
            totalDays: defaultDays,
            adjustmentDays: '0',
          })
        }
        
        console.log(`✓ Created cycle and balances for ${member.name}`)
      } else {
        console.log(`✓ ${member.name} already has an employment cycle`)
      }
    }
    
    console.log('\n✅ Vacation system initialization complete!')
    console.log('\nDefault allocations:')
    console.log('- Vacation: 30 days')
    console.log('- Sick Leave: 10 days')
    console.log('- Personal Leave: 5 days')
    console.log('\nYou can adjust these values through the admin interface.')
    
  } catch (error) {
    console.error('Error initializing vacation data:', error)
    process.exit(1)
  }
}

// Run the initialization
initVacationData()
  .then(() => {
    console.log('\nDone!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Failed to initialize:', error)
    process.exit(1)
  })