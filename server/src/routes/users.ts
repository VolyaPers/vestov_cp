import { Router } from 'express'
import { db, pool } from '../db/index.js'
import { users, clientUsers, clients, teamMembers, messages, serviceRequests, financialData, feedback, timeEntries, employmentCycles, leaveBalances, leaveRequests, leaveRequestEvents, shiftSchedules, shifts, shiftBreaks, clientServiceTeamMembers, invoiceDevelopers, reimbursementRequests } from '../db/schema.js'
import { eq, and, sql, inArray } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { requireAuth } from '../middleware/auth.js'
import { createUserAccount, deactivateUserAndMemberships } from '../services/userService.js'
import { getSlackAvatarByEmail } from '../utils/slack.js'

const router = Router()

/**
 * Safely executes a delete operation, catching and logging errors for optional tables
 */
async function safeDelete(tableName: string, operation: () => Promise<any>): Promise<void> {
  try {
    await operation()
    console.log(`[HARD DELETE] Deleted ${tableName}`)
  } catch (error) {
    const err = error as Error
    const isTableMissing = err.message.includes('does not exist') || 
                           (err.message.includes('relation') && err.message.includes('does not exist'))
    
    if (isTableMissing) {
      console.log(`[HARD DELETE] ${tableName} table does not exist, skipping`)
    } else {
      console.error(`[HARD DELETE] Error deleting ${tableName}:`, error)
    }
  }
}

/**
 * Deletes optional team member related data (outside transaction to avoid aborting it)
 */
async function deleteOptionalTeamMemberData(teamMemberId: number): Promise<void> {
  console.log(`[HARD DELETE] Deleting optional team member data for teamMemberId: ${teamMemberId}`)

  const optionalOperations = [
    { name: 'leave balances', operation: () => db.delete(leaveBalances).where(eq(leaveBalances.employeeId, teamMemberId)) },
    {
      name: 'leave request events',
      operation: async () => {
        const requestIds = await db
          .select({ id: leaveRequests.id })
          .from(leaveRequests)
          .where(eq(leaveRequests.employeeId, teamMemberId))
        
        if (requestIds.length > 0) {
          const ids = requestIds.map((r) => r.id)
          await db.delete(leaveRequestEvents).where(inArray(leaveRequestEvents.leaveRequestId, ids))
        }
      }
    },
    { name: 'leave requests', operation: () => db.delete(leaveRequests).where(eq(leaveRequests.employeeId, teamMemberId)) },
    { name: 'employment cycles', operation: () => db.delete(employmentCycles).where(eq(employmentCycles.employeeId, teamMemberId)) },
    { name: 'shift schedules', operation: () => db.delete(shiftSchedules).where(eq(shiftSchedules.employeeId, teamMemberId)) },
    { name: 'reimbursement requests', operation: () => db.delete(reimbursementRequests).where(eq(reimbursementRequests.employeeId, teamMemberId)) },
    {
      name: 'shifts and breaks',
      operation: async () => {
        const shiftIds = await db
          .select({ id: shifts.id })
          .from(shifts)
          .where(eq(shifts.employeeId, teamMemberId))

        if (shiftIds.length > 0) {
          const ids = shiftIds.map((s) => s.id)
          await db.delete(shiftBreaks).where(inArray(shiftBreaks.shiftId, ids))
          await db.delete(shifts).where(inArray(shifts.id, ids))
          console.log(`[HARD DELETE] Deleted ${shiftIds.length} shift(s) and breaks`)
        } else {
          await db.delete(shifts).where(eq(shifts.employeeId, teamMemberId))
          console.log(`[HARD DELETE] Deleted shifts (no breaks found)`)
        }
      }
    },
    {
      name: 'client service team members and invoice developers',
      operation: async () => {
        // First, get all client_service_team_member IDs for this team member
        const cstmIds = await db
          .select({ id: clientServiceTeamMembers.id })
          .from(clientServiceTeamMembers)
          .where(eq(clientServiceTeamMembers.teamMemberId, teamMemberId))

        if (cstmIds.length > 0) {
          const ids = cstmIds.map((c) => c.id)
          // Delete invoice_developers that reference these client_service_team_members
          await db.delete(invoiceDevelopers).where(inArray(invoiceDevelopers.clientServiceTeamMemberId, ids))
          console.log(`[HARD DELETE] Deleted invoice_developers for ${ids.length} client_service_team_member(s)`)
        }

        // Now delete the client_service_team_members
        await db.delete(clientServiceTeamMembers).where(eq(clientServiceTeamMembers.teamMemberId, teamMemberId))
      }
    }
  ]

  // Execute all optional operations
  for (const { name, operation } of optionalOperations) {
    await safeDelete(name, operation)
  }
}

/**
 * Deletes critical team member data within a transaction
 */
async function deleteCriticalTeamMemberData(tx: any, teamMemberId: number): Promise<void> {
  console.log(`[HARD DELETE] Deleting critical team member data for teamMemberId: ${teamMemberId}`)
  
  // Delete team member record (critical - must succeed)
  await tx.delete(teamMembers).where(eq(teamMembers.id, teamMemberId))
  console.log(`[HARD DELETE] Deleted team member ${teamMemberId}`)
}

// Get users with role='team_member' that don't have a team member linked yet
router.get('/available-team-member-users', async (req, res) => {
  try {
    const availableUsers = await db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
        position: users.position,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(
        and(
          eq(users.role, 'team_member'),
          sql`${users.teamMemberId} IS NULL`,
          eq(users.isActive, true)
        )
      )
      .orderBy(users.fullName)

    res.json(availableUsers)
  } catch (error) {
    console.error('Error fetching available team member users:', error)
    res.status(500).json({ error: 'Failed to fetch available team member users' })
  }
})

// Get team members available for user creation (those without user accounts)
router.get('/available-team-members', async (req, res) => {
  try {
    // Get all team members
    const allTeamMembers = await db
      .select({
        id: teamMembers.id,
        name: teamMembers.name,
        email: teamMembers.email,
        role: teamMembers.role,
        avatarUrl: teamMembers.avatarUrl,
      })
      .from(teamMembers)
      .where(eq(teamMembers.status, 'active'))
      .orderBy(teamMembers.name)

    // Get team members who already have user accounts
    const usersWithTeamMembers = await db
      .select({ teamMemberId: users.teamMemberId })
      .from(users)
      .where(sql`${users.teamMemberId} IS NOT NULL`)

    const usedTeamMemberIds = new Set(
      usersWithTeamMembers.map(u => u.teamMemberId).filter(Boolean)
    )

    // Filter out team members who already have accounts
    const availableTeamMembers = allTeamMembers.filter(
      tm => !usedTeamMemberIds.has(tm.id)
    )

    res.json(availableTeamMembers)
  } catch (error) {
    console.error('Error fetching available team members:', error)
    res.status(500).json({ error: 'Failed to fetch available team members' })
  }
})

// Get all users with pagination and filtering
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, role, search, clientId } = req.query
    const offset = (Number(page) - 1) * Number(limit)

    let whereConditions = []

    if (role) {
      whereConditions.push(eq(users.role, role as string))
    }

    if (search) {
      whereConditions.push(
        sql`(${users.fullName} ILIKE ${`%${search}%`} OR ${users.email} ILIKE ${`%${search}%`} OR ${users.username} ILIKE ${`%${search}%`})`
      )
    }

    const usersQuery = db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
        position: users.position,
        avatarUrl: users.avatarUrl,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        teamMemberId: users.teamMemberId,
        isDeveloper: teamMembers.isDeveloper,
      })
      .from(users)
      .leftJoin(teamMembers, eq(users.teamMemberId, teamMembers.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .limit(Number(limit))
      .offset(offset)
      .orderBy(users.createdAt)

    const allUsers = await usersQuery

    // If clientId is provided, also fetch client assignments for these users
    let usersWithClientInfo = allUsers
    if (clientId) {
      const clientAssignments = await db
        .select()
        .from(clientUsers)
        .where(eq(clientUsers.clientId, Number(clientId)))

      usersWithClientInfo = allUsers.map(user => ({
        ...user,
        clientAssignment: clientAssignments.find(ca => ca.userId === user.id) || null
      }))
    }

    // Get total count for pagination
    const totalCount = await db
      .select({ count: sql`count(*)` })
      .from(users)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)

    res.json({
      users: usersWithClientInfo,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: Number(totalCount[0].count),
        pages: Math.ceil(Number(totalCount[0].count) / Number(limit))
      }
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    res.status(500).json({ error: 'Failed to fetch users' })
  }
})

// Get user by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const user = await db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
        position: users.position,
        avatarUrl: users.avatarUrl,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, Number(id)))
      .limit(1)

    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Get client assignments for this user
    const clientAssignments = await db
      .select({
        id: clientUsers.id,
        clientId: clientUsers.clientId,
        clientName: clients.name,
        accessLevel: clientUsers.accessLevel,
        isActive: clientUsers.isActive,
        assignedAt: clientUsers.assignedAt,
      })
      .from(clientUsers)
      .leftJoin(clients, eq(clientUsers.clientId, clients.id))
      .where(eq(clientUsers.userId, Number(id)))

    res.json({
      ...user[0],
      clientAssignments
    })
  } catch (error) {
    console.error('Error fetching user:', error)
    res.status(500).json({ error: 'Failed to fetch user' })
  }
})

// Create new user
router.post('/', async (req, res) => {
  try {
    const { username, password, fullName, email, role, position, avatarUrl, teamMemberId } = req.body || {}

    if (!fullName || !email || !role) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const allowedRoles = ['admin', 'team_member', 'client']
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' })
    }

    // If role is team_member and no teamMemberId provided, user will be created without team member link
    // Team member can be created and linked later from the Team page

    const createdBy = (req as any)?.user?.id ?? null

    const { user } = await createUserAccount({
      username,
      password,
      fullName,
      email,
      role,
      position,
      avatarUrl,
      teamMemberId: teamMemberId ? Number(teamMemberId) : undefined,
      createdBy,
      source: 'admin_create'
    })

    // Auto-sync Slack avatar (async, don't wait for it)
    if (!avatarUrl) {
      getSlackAvatarByEmail(email).then(async (slackAvatar) => {
        if (slackAvatar) {
          const slackAvatarUrl = slackAvatar.avatar192 || slackAvatar.avatar512 || slackAvatar.avatar72
          if (slackAvatarUrl) {
            try {
              await db.update(users).set({ avatarUrl: slackAvatarUrl }).where(eq(users.id, user.id))
              if (user.teamMemberId) {
                await db.update(teamMembers).set({ avatarUrl: slackAvatarUrl }).where(eq(teamMembers.id, user.teamMemberId))
              }
              console.log(`[SLACK] Auto-synced avatar for new user: ${email}`)
            } catch (err) {
              console.error(`[SLACK] Failed to save avatar for new user: ${email}`, err)
            }
          }
        }
      }).catch(err => {
        console.error(`[SLACK] Failed to fetch avatar for new user: ${email}`, err)
      })
    }

    const { password: _, ...userWithoutPassword } = user
    res.status(201).json({
      user: userWithoutPassword,
    })
  } catch (error) {
    console.error('Error creating user:', error)
    const message = error instanceof Error ? error.message : 'Failed to create user'
    const status = message.includes('exists') || message.includes('already') ? 409 : 500
    res.status(status).json({ error: message })
  }
})

// Update user
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { username, fullName, email, role, position, avatarUrl, isActive, password, isDeveloper } = req.body

    const updateData: {
      username?: string
      fullName?: string
      email?: string
      role?: string
      position?: string | null
      avatarUrl?: string | null
      isActive?: boolean
      password?: string
      updatedAt: Date
    } = { updatedAt: new Date() }
    if (username !== undefined) updateData.username = username
    if (fullName !== undefined) updateData.fullName = fullName
    if (email !== undefined) updateData.email = email
    if (role !== undefined) updateData.role = role
    if (position !== undefined) updateData.position = position
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl
    if (isActive !== undefined) updateData.isActive = isActive
    if (password !== undefined && password.trim() !== '') {
      // Hash the password before storing
      const hashedPassword = await bcrypt.hash(password, 10)
      updateData.password = hashedPassword
    }

    const updatedUser = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, Number(id)))
      .returning()

    if (updatedUser.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Handle isDeveloper flag for team_member role users
    let finalIsDeveloper = isDeveloper
    if (isDeveloper !== undefined && updatedUser[0].role === 'team_member') {
      if (updatedUser[0].teamMemberId) {
        // User has linked team member - update it
        await db
          .update(teamMembers)
          .set({ isDeveloper: isDeveloper })
          .where(eq(teamMembers.id, updatedUser[0].teamMemberId))
      } else {
        // User doesn't have a team member yet - create one
        const today = new Date().toISOString().slice(0, 10)
        const [newMember] = await db
          .insert(teamMembers)
          .values({
            name: updatedUser[0].fullName,
            role: updatedUser[0].position || 'Team Member',
            email: updatedUser[0].email,
            startDate: today,
            status: 'active',
            isBillable: true,
            position: updatedUser[0].position,
            isDeveloper: isDeveloper,
          })
          .returning()

        // Link the new team member to the user
        await db
          .update(users)
          .set({ teamMemberId: newMember.id, updatedAt: new Date() })
          .where(eq(users.id, Number(id)))
      }
    }

    const { password: _, ...userWithoutPassword } = updatedUser[0]
    res.json({ ...userWithoutPassword, isDeveloper: finalIsDeveloper })
  } catch (error) {
    console.error('Error updating user:', error)
    res.status(500).json({ error: 'Failed to update user' })
  }
})

// Update user password
router.put('/:id/password', async (req, res) => {
  try {
    const { id } = req.params
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' })
    }

    // Get current user
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, Number(id)))
      .limit(1)

    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user[0].password)
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' })
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10)

    await db
      .update(users)
      .set({
        password: hashedNewPassword,
        updatedAt: new Date()
      })
      .where(eq(users.id, Number(id)))

    res.json({ message: 'Password updated successfully' })
  } catch (error) {
    console.error('Error updating password:', error)
    res.status(500).json({ error: 'Failed to update password' })
  }
})

// Assign user to client
router.post('/:userId/clients/:clientId', async (req, res) => {
  try {
    const { userId, clientId } = req.params
    const { accessLevel = 'read', assignedBy } = req.body

    if (!assignedBy) {
      return res.status(400).json({ error: 'assignedBy is required' })
    }

    // Check if user exists and get their current role
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, Number(userId)))
      .limit(1)

    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Ensure user has 'client' role before assignment
    if (user[0].role !== 'client') {
      return res.status(400).json({ error: 'Only users with "client" role can be assigned to clients' })
    }

    // Check if assignment already exists
    const existingAssignment = await db
      .select()
      .from(clientUsers)
      .where(and(
        eq(clientUsers.userId, Number(userId)),
        eq(clientUsers.clientId, Number(clientId))
      ))
      .limit(1)

    if (existingAssignment.length > 0) {
      return res.status(409).json({ error: 'User is already assigned to this client' })
    }

    const assignment = await db
      .insert(clientUsers)
      .values({
        userId: Number(userId),
        clientId: Number(clientId),
        accessLevel: accessLevel as 'read' | 'write' | 'admin',
        assignedBy: Number(assignedBy),
        isActive: true,
      })
      .returning()

    res.status(201).json(assignment[0])
  } catch (error) {
    console.error('Error assigning user to client:', error)
    res.status(500).json({ error: 'Failed to assign user to client' })
  }
})

// Update client assignment
router.put('/:userId/clients/:clientId', async (req, res) => {
  try {
    const { userId, clientId } = req.params
    const { accessLevel, isActive } = req.body

    const updateData: {
      accessLevel?: 'read' | 'write' | 'admin'
      isActive?: boolean
      updatedAt: Date
    } = { updatedAt: new Date() }
    if (accessLevel !== undefined) updateData.accessLevel = accessLevel
    if (isActive !== undefined) updateData.isActive = isActive

    const updatedAssignment = await db
      .update(clientUsers)
      .set(updateData)
      .where(and(
        eq(clientUsers.userId, Number(userId)),
        eq(clientUsers.clientId, Number(clientId))
      ))
      .returning()

    if (updatedAssignment.length === 0) {
      return res.status(404).json({ error: 'Client assignment not found' })
    }

    res.json(updatedAssignment[0])
  } catch (error) {
    console.error('Error updating client assignment:', error)
    res.status(500).json({ error: 'Failed to update client assignment' })
  }
})

// Remove user from client
router.delete('/:userId/clients/:clientId', async (req, res) => {
  try {
    const { userId, clientId } = req.params

    const deletedAssignment = await db
      .delete(clientUsers)
      .where(and(
        eq(clientUsers.userId, Number(userId)),
        eq(clientUsers.clientId, Number(clientId))
      ))
      .returning()

    if (deletedAssignment.length === 0) {
      return res.status(404).json({ error: 'Client assignment not found' })
    }

    res.json({ message: 'User removed from client successfully' })
  } catch (error) {
    console.error('Error removing user from client:', error)
    res.status(500).json({ error: 'Failed to remove user from client' })
  }
})

// Get users assigned to a specific client
router.get('/clients/:clientId/users', async (req, res) => {
  try {
    const { clientId } = req.params

    const assignedUsers = await db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
        position: users.position,
        avatarUrl: users.avatarUrl,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
        assignmentId: clientUsers.id,
        accessLevel: clientUsers.accessLevel,
        assignmentActive: clientUsers.isActive,
        assignedAt: clientUsers.assignedAt,
        assignedBy: clientUsers.assignedBy,
      })
      .from(clientUsers)
      .leftJoin(users, eq(clientUsers.userId, users.id))
      .where(eq(clientUsers.clientId, Number(clientId)))
      .orderBy(clientUsers.assignedAt)

    res.json(assignedUsers)
  } catch (error) {
    console.error('Error fetching client users:', error)
    res.status(500).json({ error: 'Failed to fetch client users' })
  }
})

// Deactivate user (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const [user] = await db.select().from(users).where(eq(users.id, Number(id))).limit(1)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    await deactivateUserAndMemberships(Number(id))

    res.json({ message: 'User deactivated and memberships revoked' })
  } catch (error) {
    console.error('Error deactivating user:', error)
    res.status(500).json({ error: 'Failed to deactivate user' })
  }
})

// Hard delete user and related records (admin only)
router.delete('/:id/hard', requireAuth, async (req, res) => {
  try {
    console.log('[HARD DELETE] Request received:', {
      method: req.method,
      path: req.path,
      userId: req.params.id,
      origin: req.headers.origin,
      user: req.user ? { id: req.user.id, role: req.user.role } : 'no user',
    })
    
    const { id } = req.params
    const authUser = (req as any).user

    if (!authUser || authUser.role !== 'admin') {
      console.log('[HARD DELETE] Access denied - not admin')
      const origin = req.headers.origin
      if (origin) {
        res.header('Access-Control-Allow-Origin', origin)
        res.header('Access-Control-Allow-Credentials', 'true')
      }
      return res.status(403).json({ error: 'Admin access required' })
    }

    const userId = Number(id)
    console.log(`[HARD DELETE] Looking for user with ID: ${userId}`)
    
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
    if (!user) {
      console.log(`[HARD DELETE] User ${userId} not found`)
      const origin = req.headers.origin
      if (origin) {
        res.header('Access-Control-Allow-Origin', origin)
        res.header('Access-Control-Allow-Credentials', 'true')
      }
      return res.status(404).json({ error: 'User not found' })
    }

    console.log(`[HARD DELETE] Found user: ${user.email}, teamMemberId: ${user.teamMemberId}`)

    // Helper: Safely delete from optional tables (outside transaction to avoid aborting it)
    const safeDelete = async (tableName: string, operation: () => Promise<void>): Promise<void> => {
      try {
        await operation()
        console.log(`[HARD DELETE] Deleted ${tableName}`)
      } catch (error) {
        const err = error as Error
        const isTableMissing = err.message.includes('does not exist') || 
                               (err.message.includes('relation') && err.message.includes('does not exist'))
        
        if (isTableMissing) {
          console.log(`[HARD DELETE] ${tableName} table does not exist, skipping`)
        } else {
          console.error(`[HARD DELETE] Error deleting ${tableName}:`, error)
        }
        // Don't throw - these are optional operations
      }
    }

    // Delete optional tables (outside transaction to prevent transaction abortion)
    const optionalDeletions = [
      {
        name: 'client_users',
        operation: () => db.delete(clientUsers).where(eq(clientUsers.userId, userId))
      },
      {
        name: 'messages',
        operation: () => db.delete(messages).where(
          sql`${messages.senderId} = ${userId} OR ${messages.receiverId} = ${userId}`
        )
      },
      {
        name: 'service_requests',
        operation: () => db.delete(serviceRequests).where(eq(serviceRequests.userId, userId))
      },
      {
        name: 'financial_data',
        operation: () => db.delete(financialData).where(eq(financialData.userId, userId))
      },
      {
        name: 'feedback',
        operation: () => db.delete(feedback).where(
          sql`${feedback.userId} = ${userId} OR ${feedback.teamMemberId} = ${user.teamMemberId ?? -1}`
        )
      },
      {
        name: 'time_entries',
        operation: () => db.delete(timeEntries).where(
          sql`${timeEntries.userId} = ${userId} OR ${
            user.teamMemberId ? sql`${timeEntries.teamMemberId} = ${user.teamMemberId}` : sql`false`
          }`
        )
      }
    ]

    await Promise.all(optionalDeletions.map(({ name, operation }) => safeDelete(name, async () => { await operation() })))

    // Delete optional team member data (outside transaction to prevent transaction abortion)
    if (user.teamMemberId) {
      await deleteOptionalTeamMemberData(user.teamMemberId)
    }

    // Now do the critical deletions in a transaction
    try {
      await db.transaction(async (tx) => {
        console.log(`[HARD DELETE] Starting critical deletion of user ${userId} (${user.email})`)

      // Delete critical team member data if user has teamMemberId
      if (user.teamMemberId) {
        await deleteCriticalTeamMemberData(tx, user.teamMemberId)
      }

      try {
        // Delete user - THIS MUST BE LAST to avoid foreign key issues
        await tx.delete(users).where(eq(users.id, userId))
        console.log(`[HARD DELETE] Deleted user ${userId} (${user.email})`)
      } catch (error) {
        console.error('[HARD DELETE] Error deleting user:', error)
        throw error // This is critical, so throw
      }
      })
      console.log(`[HARD DELETE] Transaction completed successfully`)
    } catch (transactionError) {
      const txErr = transactionError as Error
      console.error('========================================')
      console.error('[HARD DELETE] TRANSACTION ERROR:', txErr.message)
      console.error('[HARD DELETE] Transaction error stack:', txErr.stack)
      console.error('========================================')
      throw transactionError // Re-throw to be caught by outer catch
    }

    // Verify deletion - check by ID and email/username to be thorough
    const [verifyById] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
    const [verifyByEmail] = await db
      .select()
      .from(users)
      .where(eq(users.email, user.email))
      .limit(1)
    const [verifyByUsername] = await db
      .select()
      .from(users)
      .where(eq(users.username, user.username))
      .limit(1)

    if (verifyById || verifyByEmail || verifyByUsername) {
      console.error(`[HARD DELETE] WARNING: User ${userId} (${user.email}) still exists after deletion!`)
      console.error(`[HARD DELETE] Found by ID: ${!!verifyById}, by email: ${!!verifyByEmail}, by username: ${!!verifyByUsername}`)
      return res.status(500).json({ error: 'User deletion failed - user still exists in database' })
    }

    console.log(`[HARD DELETE] Successfully deleted user ${userId} (${user.email}) and all related data`)
    
    // Set CORS headers explicitly
    const origin = req.headers.origin
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin)
      res.header('Access-Control-Allow-Credentials', 'true')
    }
    
    res.json({ message: 'User and related data deleted successfully' })
  } catch (error) {
    const err = error as Error
    console.error('========================================')
    console.error('[HARD DELETE] ERROR:', err.message)
    console.error('[HARD DELETE] Stack:', err.stack)
    console.error('[HARD DELETE] User ID:', req.params.id)
    console.error('[HARD DELETE] Auth User:', req.user ? { id: req.user.id, role: req.user.role } : 'no user')
    console.error('========================================')
    
    // Set CORS headers on error too
    const origin = req.headers.origin
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin)
      res.header('Access-Control-Allow-Credentials', 'true')
    }
    
    // Provide more specific error message if possible
    let errorMessage = 'Failed to delete user'
    if (err.message.includes('foreign key') || err.message.includes('constraint')) {
      errorMessage = 'Cannot delete user: user has related records that must be deleted first'
    } else if (err.message) {
      errorMessage = `Failed to delete user: ${err.message}`
    }
    
    res.status(500).json({ error: errorMessage })
  }
})

// Get Slack avatar for a user by email
router.get('/:id/slack-avatar', async (req, res) => {
  try {
    const { id } = req.params

    // Get user email
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, Number(id)))
      .limit(1)

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const slackAvatar = await getSlackAvatarByEmail(user.email)

    if (!slackAvatar) {
      return res.status(404).json({ error: 'Slack user not found for this email' })
    }

    res.json({
      avatarUrl: slackAvatar.avatar192 || slackAvatar.avatar72,
      avatar72: slackAvatar.avatar72,
      avatar192: slackAvatar.avatar192,
      avatar512: slackAvatar.avatar512,
      slackUserId: slackAvatar.slackUserId
    })
  } catch (error) {
    console.error('Error fetching Slack avatar:', error)
    res.status(500).json({ error: 'Failed to fetch Slack avatar' })
  }
})

// Sync Slack avatar - fetches from Slack and saves to user profile
router.post('/:id/sync-slack-avatar', async (req, res) => {
  try {
    const { id } = req.params

    // Get user email
    const [user] = await db
      .select({ email: users.email, avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, Number(id)))
      .limit(1)

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const slackAvatar = await getSlackAvatarByEmail(user.email)

    if (!slackAvatar) {
      return res.status(404).json({ error: 'Slack user not found for this email' })
    }

    // Use the 192px version as default (good balance of quality and size)
    const avatarUrl = slackAvatar.avatar192 || slackAvatar.avatar512 || slackAvatar.avatar72

    if (!avatarUrl) {
      return res.status(404).json({ error: 'No avatar found for this Slack user' })
    }

    // Update user's avatar URL
    const [updatedUser] = await db
      .update(users)
      .set({ avatarUrl, updatedAt: new Date() })
      .where(eq(users.id, Number(id)))
      .returning()

    // Also update team_member avatar if linked
    if (updatedUser.teamMemberId) {
      await db
        .update(teamMembers)
        .set({ avatarUrl })
        .where(eq(teamMembers.id, updatedUser.teamMemberId))
    }

    res.json({
      success: true,
      avatarUrl,
      message: 'Avatar synced from Slack successfully'
    })
  } catch (error) {
    console.error('Error syncing Slack avatar:', error)
    res.status(500).json({ error: 'Failed to sync Slack avatar' })
  }
})

// Bulk sync all users' avatars from Slack
router.post('/sync-all-slack-avatars', async (req, res) => {
  try {
    const allUsers = await db
      .select({ id: users.id, email: users.email, teamMemberId: users.teamMemberId })
      .from(users)

    const results = {
      total: allUsers.length,
      synced: 0,
      notFound: 0,
      errors: 0
    }

    for (const user of allUsers) {
      try {
        const slackAvatar = await getSlackAvatarByEmail(user.email)

        if (slackAvatar) {
          const avatarUrl = slackAvatar.avatar192 || slackAvatar.avatar512 || slackAvatar.avatar72

          if (avatarUrl) {
            await db
              .update(users)
              .set({ avatarUrl, updatedAt: new Date() })
              .where(eq(users.id, user.id))

            if (user.teamMemberId) {
              await db
                .update(teamMembers)
                .set({ avatarUrl })
                .where(eq(teamMembers.id, user.teamMemberId))
            }

            results.synced++
          } else {
            results.notFound++
          }
        } else {
          results.notFound++
        }
      } catch {
        results.errors++
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    res.json({
      success: true,
      message: `Synced ${results.synced} avatars from Slack`,
      results
    })
  } catch (error) {
    console.error('Error bulk syncing Slack avatars:', error)
    res.status(500).json({ error: 'Failed to bulk sync Slack avatars' })
  }
})

export default router