import { db } from '../db/index.js'
import { teamMembers, users } from '../db/schema.js'
import { eq, isNull, and, sql } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { createUserAccount } from '../services/userService.js'

/**
 * Script to fix orphaned team members:
 * 1. Find team members without linked users
 * 2. For those with email: create user account and link
 * 3. For those without email: delete them
 * 
 * This script should run automatically once on deployment
 */
async function fixOrphanedTeamMembers() {
  try {
    console.log('🔍 Starting fix for orphaned team members...\n')

    // Find all team members that don't have a linked user
    // Get all team member IDs that have users linked
    const linkedTeamMemberIds = await db
      .select({ id: users.teamMemberId })
      .from(users)
      .where(sql`${users.teamMemberId} IS NOT NULL`)

    const linkedIds = new Set(linkedTeamMemberIds.map(u => u.id).filter((id): id is number => id !== null))

    // Get all team members and filter out those that are linked
    const allMembers = await db.select().from(teamMembers)
    const orphanedMembers = allMembers.filter(member => !linkedIds.has(member.id))

    if (orphanedMembers.length === 0) {
      console.log('✅ No orphaned team members found. All team members are linked to users.')
      process.exit(0)
      return
    }

    console.log(`📊 Found ${orphanedMembers.length} orphaned team member(s)\n`)

    const createdUsers: Array<{ teamMemberId: number; userId: number; email: string }> = []
    const deletedMembers: Array<{ id: number; name: string; reason: string }> = []
    const errors: Array<{ teamMemberId: number; error: string }> = []

    for (const member of orphanedMembers) {

      // If no email, delete the team member
      if (!member.email || member.email.trim() === '') {
        console.log(`🗑️  Deleting team member ${member.id} (${member.name}) - no email`)
        
        try {
          await db.delete(teamMembers).where(eq(teamMembers.id, member.id))
          deletedMembers.push({
            id: member.id,
            name: member.name,
            reason: 'No email address'
          })
        } catch (error) {
          console.error(`❌ Error deleting team member ${member.id}:`, error)
          errors.push({
            teamMemberId: member.id,
            error: `Failed to delete: ${error instanceof Error ? error.message : 'Unknown error'}`
          })
        }
        continue
      }

      // Check if user with this email already exists
      const normalizedEmail = member.email.trim().toLowerCase()
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1)

      if (existingUser) {
        // User exists but not linked - link them
        if (existingUser.role === 'team_member' && !existingUser.teamMemberId) {
          console.log(`🔗 Linking existing user ${existingUser.id} (${existingUser.email}) to team member ${member.id}`)
          
          try {
            await db
              .update(users)
              .set({ teamMemberId: member.id, updatedAt: new Date() })
              .where(eq(users.id, existingUser.id))
            
            createdUsers.push({
              teamMemberId: member.id,
              userId: existingUser.id,
              email: existingUser.email
            })
          } catch (error) {
            console.error(`❌ Error linking user ${existingUser.id} to team member ${member.id}:`, error)
            errors.push({
              teamMemberId: member.id,
              error: `Failed to link existing user: ${error instanceof Error ? error.message : 'Unknown error'}`
            })
          }
        } else {
          // User exists but has different role or already linked - can't auto-fix
          console.log(`⚠️  Team member ${member.id} (${member.email}) - user exists but with role '${existingUser.role}' or already linked. Skipping.`)
          errors.push({
            teamMemberId: member.id,
            error: `User with email ${normalizedEmail} exists but has role '${existingUser.role}' or is already linked`
          })
        }
        continue
      }

      // Create new user for this team member
      console.log(`👤 Creating user for team member ${member.id} (${member.email})`)
      
      try {
        const username = normalizedEmail.split('@')[0] // Use email prefix as username
        const fullName = member.name
        const position = member.role || 'Team Member'
        
        // Generate a random password (user will need to reset it)
        const randomPassword = crypto.randomUUID()
        
        const { user } = await createUserAccount({
          username,
          password: randomPassword,
          fullName,
          email: normalizedEmail,
          role: 'team_member',
          position,
          teamMemberId: member.id,
          source: 'orphaned_fix',
          isActive: true
        })

        createdUsers.push({
          teamMemberId: member.id,
          userId: user.id,
          email: user.email
        })

        console.log(`✅ Created user ${user.id} for team member ${member.id}`)
      } catch (error) {
        console.error(`❌ Error creating user for team member ${member.id}:`, error)
        errors.push({
          teamMemberId: member.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(60))
    console.log('📋 SUMMARY')
    console.log('='.repeat(60))
    console.log(`✅ Users created/linked: ${createdUsers.length}`)
    console.log(`🗑️  Team members deleted: ${deletedMembers.length}`)
    console.log(`⚠️  Errors: ${errors.length}`)
    
    if (createdUsers.length > 0) {
      console.log('\n✅ Created/Linked Users:')
      createdUsers.forEach(({ teamMemberId, userId, email }) => {
        console.log(`   - Team Member ${teamMemberId} → User ${userId} (${email})`)
      })
    }

    if (deletedMembers.length > 0) {
      console.log('\n🗑️  Deleted Team Members:')
      deletedMembers.forEach(({ id, name, reason }) => {
        console.log(`   - Team Member ${id}: ${name} (${reason})`)
      })
    }

    if (errors.length > 0) {
      console.log('\n⚠️  Errors (require manual review):')
      errors.forEach(({ teamMemberId, error }) => {
        console.log(`   - Team Member ${teamMemberId}: ${error}`)
      })
    }

    console.log('\n' + '='.repeat(60))
    
    if (errors.length > 0) {
      console.log('⚠️  Some team members could not be fixed automatically. Please review the errors above.')
      process.exit(1)
    } else {
      console.log('✅ All orphaned team members have been fixed!')
      process.exit(0)
    }
  } catch (error) {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  }
}

// Run the script
fixOrphanedTeamMembers()

