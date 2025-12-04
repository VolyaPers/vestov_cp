import { db } from '../db/index.js';
import { employmentCycles, leaveBalances, teamMembers, leaveTypes } from '../db/schema.js';
import { eq } from 'drizzle-orm';
/**
 * Setup employment cycles and leave balances for all team members
 * This is required for the vacation approval system to work
 */
async function setupVacationData() {
    try {
        console.log('🔧 Setting up vacation data...');
        // Get all team members
        const members = await db.select().from(teamMembers);
        console.log(`📋 Found ${members.length} team members`);
        // Get all leave types
        const types = await db.select().from(leaveTypes);
        console.log(`📋 Found ${types.length} leave types`);
        // Current year cycle dates
        const currentYear = new Date().getFullYear();
        const cycleStart = `${currentYear}-01-01`;
        const cycleEnd = `${currentYear}-12-31`;
        for (const member of members) {
            console.log(`\n👤 Processing ${member.name}...`);
            // Check if employment cycle already exists
            const existingCycles = await db
                .select()
                .from(employmentCycles)
                .where(eq(employmentCycles.employeeId, member.id));
            if (existingCycles.length === 0) {
                // Create employment cycle
                const [cycle] = await db
                    .insert(employmentCycles)
                    .values({
                    employeeId: member.id,
                    cycleStart,
                    cycleEnd,
                    cycleNumber: 1,
                    isActive: true,
                })
                    .returning();
                console.log(`  ✅ Created employment cycle (${cycleStart} - ${cycleEnd})`);
                // Create leave balances for each leave type
                for (const leaveType of types) {
                    // Allocation rules:
                    // - First year: 15 vacation days
                    // - Second year: 20 vacation days
                    // - Third year+: 25 vacation days
                    // - Sick leave: always 7 days per year
                    let totalDays = 0;
                    if (leaveType.name === 'Vacation') {
                        totalDays = 15; // First year gets 15 vacation days
                    }
                    else if (leaveType.name === 'Sick Leave') {
                        totalDays = 7; // All years get 7 sick leave days
                    }
                    else if (leaveType.name === 'Personal') {
                        totalDays = 5;
                    }
                    else {
                        totalDays = 0; // Other leave types start with 0
                    }
                    await db.insert(leaveBalances).values({
                        employeeId: member.id,
                        employmentCycleId: cycle.id,
                        leaveTypeId: leaveType.id,
                        totalDays: totalDays.toString(),
                        adjustmentDays: '0',
                    });
                    console.log(`  ✅ Created ${leaveType.name} balance: ${totalDays} days`);
                }
            }
            else {
                console.log(`  ℹ️  Employment cycle already exists`);
            }
        }
        console.log('\n🎉 Vacation data setup completed successfully!');
    }
    catch (error) {
        console.error('❌ Error setting up vacation data:', error);
        process.exit(1);
    }
    finally {
        process.exit(0);
    }
}
setupVacationData();
