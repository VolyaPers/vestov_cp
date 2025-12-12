import { Router } from 'express'
import { db } from '../db/index.js'
import { users, clientUsers, clients, teamMembers, messages, serviceRequests, financialData, feedback, timeEntries, employmentCycles, leaveBalances, leaveRequests, shiftSchedules, shifts, shiftBreaks } from '../db/schema.js'
import { eq, and, sql, inArray } from 'drizzle-orm'
import bcrypt from 'bcrypt'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

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
      })
      .from(users)
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
    const { username, password, fullName, email, role, position, avatarUrl, teamMemberId } = req.body

    if (!username || !password || !fullName || !email || !role) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // If role is team_member, teamMemberId is required
    if (role === 'team_member' && !teamMemberId) {
      return res.status(400).json({ error: 'Team member must be selected for team_member role' })
    }

    // Validate team member exists if provided
    if (teamMemberId) {
      const [teamMember] = await db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.id, Number(teamMemberId)))
        .limit(1)

      if (!teamMember) {
        return res.status(404).json({ error: 'Selected team member not found' })
      }

      // Check if team member already has a user account
      const existingTeamMemberUser = await db
        .select()
        .from(users)
        .where(eq(users.teamMemberId, Number(teamMemberId)))
        .limit(1)

      if (existingTeamMemberUser.length > 0) {
        return res.status(409).json({ error: 'This team member already has a user account' })
      }
    }

    // Check if username or email already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(sql`${users.username} = ${username} OR ${users.email} = ${email}`)
      .limit(1)

    if (existingUser.length > 0) {
      return res.status(409).json({ error: 'Username or email already exists' })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    const newUser = await db
      .insert(users)
      .values({
        username,
        password: hashedPassword,
        fullName,
        email,
        role: role as 'admin' | 'team_member' | 'client',
        position,
        avatarUrl,
        teamMemberId: teamMemberId ? Number(teamMemberId) : null,
        isActive: true,
      })
      .returning()

    const { password: _, ...userWithoutPassword } = newUser[0]
    res.status(201).json(userWithoutPassword)
  } catch (error) {
    console.error('Error creating user:', error)
    res.status(500).json({ error: 'Failed to create user' })
  }
})

// Update user
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { username, fullName, email, role, position, avatarUrl, isActive } = req.body

    const updateData: any = {}
    if (username !== undefined) updateData.username = username
    if (fullName !== undefined) updateData.fullName = fullName
    if (email !== undefined) updateData.email = email
    if (role !== undefined) updateData.role = role
    if (position !== undefined) updateData.position = position
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl
    if (isActive !== undefined) updateData.isActive = isActive
    updateData.updatedAt = new Date()

    const updatedUser = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, Number(id)))
      .returning()

    if (updatedUser.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    const { password: _, ...userWithoutPassword } = updatedUser[0]
    res.json(userWithoutPassword)
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

    const updateData: any = {}
    if (accessLevel !== undefined) updateData.accessLevel = accessLevel
    if (isActive !== undefined) updateData.isActive = isActive
    updateData.updatedAt = new Date()

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

    const updatedUser = await db
      .update(users)
      .set({
        isActive: false,
        updatedAt: new Date()
      })
      .where(eq(users.id, Number(id)))
      .returning()

    if (updatedUser.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({ message: 'User deactivated successfully' })
  } catch (error) {
    console.error('Error deactivating user:', error)
    res.status(500).json({ error: 'Failed to deactivate user' })
  }
})

// Hard delete user and related records (admin only)
router.delete('/:id/hard', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const authUser: any = (req as any).user

    if (!authUser || authUser.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const userId = Number(id)
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    await db.transaction(async (tx) => {
      // Delete client assignments
      await tx.delete(clientUsers).where(eq(clientUsers.userId, userId))

      // Delete messages (sender or receiver)
      await tx.delete(messages).where(
        sql`${messages.senderId} = ${userId} OR ${messages.receiverId} = ${userId}`
      )

      // Delete service requests
      await tx.delete(serviceRequests).where(eq(serviceRequests.userId, userId))

      // Delete financial data rows tied to user
      await tx.delete(financialData).where(eq(financialData.userId, userId))

      // Delete feedback linked to user
      await tx
        .delete(feedback)
        .where(sql`${feedback.userId} = ${userId} OR ${feedback.teamMemberId} = ${user.teamMemberId ?? -1}`)

      // Delete time entries by user or team member
      await tx
        .delete(timeEntries)
        .where(
          sql`${timeEntries.userId} = ${userId} OR ${
            user.teamMemberId ? sql`${timeEntries.teamMemberId} = ${user.teamMemberId}` : sql`false`
          }`
        )

      // If linked team member, delete related employment/leave/shift records
      if (user.teamMemberId) {
        const tmId = user.teamMemberId

        // Delete leave balances/requests and employment cycles
        await tx.delete(leaveBalances).where(eq(leaveBalances.employeeId, tmId))
        await tx.delete(leaveRequests).where(eq(leaveRequests.employeeId, tmId))
        await tx.delete(employmentCycles).where(eq(employmentCycles.employeeId, tmId))

        // Delete shift schedules
        await tx.delete(shiftSchedules).where(eq(shiftSchedules.employeeId, tmId))

        // Delete shifts and break records
        const shiftIds = await tx
          .select({ id: shifts.id })
          .from(shifts)
          .where(eq(shifts.employeeId, tmId))

        if (shiftIds.length > 0) {
          const ids = shiftIds.map((s) => s.id)
          await tx.delete(shiftBreaks).where(inArray(shiftBreaks.shiftId, ids))
          await tx.delete(shifts).where(inArray(shifts.id, ids))
        } else {
          await tx.delete(shifts).where(eq(shifts.employeeId, tmId))
        }

        // Delete team member record
        await tx.delete(teamMembers).where(eq(teamMembers.id, tmId))
      }

      // Delete user
      await tx.delete(users).where(eq(users.id, userId))
    })

    res.json({ message: 'User and related data deleted successfully' })
  } catch (error) {
    console.error('Error hard-deleting user:', error)
    res.status(500).json({ error: 'Failed to delete user' })
  }
})

export default router