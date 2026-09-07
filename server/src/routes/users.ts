import { assertPortalAccount, isFreelancerAccount } from '../services/employmentPolicy.js'
import { Router } from 'express'
import { db, pool } from '../db/index.js'
import { users, clientUsers, clients, teamMembers, messages, serviceRequests, financialData, feedback, timeEntries, employmentCycles, leaveBalances, leaveRequests, leaveRequestEvents, shiftSchedules, shifts, shiftBreaks, clientServiceTeamMembers, invoiceDevelopers, invoices, invoiceServices, reimbursementRequests, documents, documentFolders } from '../db/schema.js'
import { eq, and, sql, inArray } from 'drizzle-orm'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { createUserAccount, deactivateUserAndMemberships } from '../services/userService.js'
import { revokeUserSockets } from '../socket.js'
import { createClerkClient } from '@clerk/backend'
import { generateInvitationLink, type InvitationGateway } from '../services/userInvitation.js'
import { getSlackAvatarByEmail } from '../utils/slack.js'

export function createUsersRouter(options: { invitations?: InvitationGateway } = {}) {
const router = Router()

router.use(requireAuth, requireAdmin)
for (const param of ['id', 'userId', 'clientId']) router.param(param, (_req, res, next, value) => {
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) return res.status(400).json({ error: `Invalid ${param}` })
  next()
})

async function guardAdminChange(tx: any, userId: number, actorId: number, deactivating: boolean) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(743991)`)
  const [user] = await tx.select().from(users).where(eq(users.id, userId)).for('update')
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 })
  if (deactivating && actorId === userId) throw Object.assign(new Error('You cannot deactivate, delete or remove your own admin role'), { status: 409 })
  if (deactivating && user.role === 'admin' && user.isActive) {
    const active = await tx.select({ id: users.id }).from(users).where(and(eq(users.role, 'admin'), eq(users.isActive, true)))
    if (active.length < 2) throw Object.assign(new Error('The last active administrator cannot be removed'), { status: 409 })
  }
  return user
}

// Get users that don't have a team member linked yet (team_member or admin roles)
router.get('/available-team-member-users', async (req, res) => {
  try {
    const availableUsers = await db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
        clerkUserId: users.clerkUserId,
        authProvider: users.authProvider,
        timezone: users.timezone,
        position: users.position,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(
        and(
          sql`${users.role} IN ('team_member', 'admin')`,
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

// Get all users with pagination and filtering
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 100, role, search, clientId } = req.query
    if (!Number.isInteger(Number(page)) || Number(page) < 1 || !Number.isInteger(Number(limit)) || Number(limit) < 1 || Number(limit) > 500) return res.status(400).json({ error: 'Invalid pagination' })
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
        clerkUserId: users.clerkUserId,
        authProvider: users.authProvider,
        timezone: users.timezone,
        position: users.position,
        avatarUrl: users.avatarUrl,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        teamMemberId: users.teamMemberId,
      })
      .from(users)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .limit(Number(limit))
      .offset(offset)
      .orderBy(users.createdAt)

    const [allUsers, totalCount] = await Promise.all([
      usersQuery,
      db.select({ count: sql`count(*)` }).from(users)
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined),
    ])

    // Fetch memberships for this page in one query instead of one HTTP call per client user.
    const userIds = allUsers.map(user => user.id)
    const assignments = userIds.length ? await db.select({
      userId: clientUsers.userId,
      id: clientUsers.id,
      assignmentId: clientUsers.id,
      assignedBy: clientUsers.assignedBy,
      clientId: clientUsers.clientId,
      clientName: clients.name,
      accessLevel: clientUsers.accessLevel,
      isActive: clientUsers.isActive,
      assignedAt: clientUsers.assignedAt,
    }).from(clientUsers).leftJoin(clients, eq(clientUsers.clientId, clients.id))
      .where(inArray(clientUsers.userId, userIds)) : []
    const byUser = new Map<number, typeof assignments>()
    for (const assignment of assignments) {
      const list = byUser.get(assignment.userId) || []
      list.push(assignment)
      byUser.set(assignment.userId, list)
    }
    const usersWithClientInfo = allUsers.map(user => {
      const clientAssignments = byUser.get(user.id) || []
      return {
        ...user,
        clientAssignments,
        ...(clientId ? { clientAssignment: clientAssignments.find(item => item.clientId === Number(clientId)) || null } : {}),
      }
    })

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
        clerkUserId: users.clerkUserId,
        authProvider: users.authProvider,
        timezone: users.timezone,
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
    const { username, fullName, email, role, position, avatarUrl, teamMemberId } = req.body || {}

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
      fullName,
      email,
      role,
      position,
      avatarUrl,
      teamMemberId: teamMemberId ? Number(teamMemberId) : undefined,
      createdBy,
      source: 'admin_create'
    })

    const { password: _, ...userWithoutPassword } = user
    res.status(201).json({
      user: userWithoutPassword,
    })
  } catch (error) {
    console.error('Error creating user:', error)
    const message = error instanceof Error ? error.message : 'Failed to create user'
    const status = message.includes('exists') || message.includes('already') ? 409 : 400
    res.status(status).json({ error: message })
  }
})

// Internal access changes; credentials are managed exclusively by Clerk.
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { username, fullName, email, role, position, avatarUrl, timezone, isActive } = req.body || {}
    if ('password' in (req.body || {})) return res.status(400).json({ error: 'Passwords are managed by Clerk. Use Forgot password on the sign-in page.' })
    if (role !== undefined && !['admin', 'team_member', 'client'].includes(role)) return res.status(400).json({ error: 'Invalid role' })
    if (email !== undefined && (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))) return res.status(400).json({ error: 'Invalid email' })
    if (fullName !== undefined && (typeof fullName !== 'string' || !fullName.trim())) return res.status(400).json({ error: 'Full name is required' })
    if (username !== undefined && (typeof username !== 'string' || !username.trim() || username.trim().length > 50)) return res.status(400).json({ error: 'Username must contain 1–50 characters' })
    if (isActive !== undefined && typeof isActive !== 'boolean') return res.status(400).json({ error: 'Invalid account status' })
    if (timezone) { try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }) } catch { return res.status(400).json({ error: 'Invalid timezone' }) } }
    const updated = await db.transaction(async tx => {
      const user = await guardAdminChange(tx, id, req.user!.id, isActive === false || (role !== undefined && role !== 'admin'))
      if (isActive !== false) await assertPortalAccount({ teamMemberId: user.teamMemberId, email: email ?? user.email }, tx)
      if (user.clerkUserId && email !== undefined && email.trim().toLowerCase() !== user.email.toLowerCase()) throw Object.assign(new Error('Change the verified email in Clerk first; a linked identity cannot be reassigned by editing this field'), { status: 409 })
      if (user.teamMemberId && role === 'client') throw Object.assign(new Error('This account is linked to an employee profile. Preserve its employee role.'), { status: 409 })
      const updateData: any = { updatedAt: new Date() }
      if (username !== undefined) updateData.username = username.trim().toLowerCase()
      if (fullName !== undefined) updateData.fullName = fullName.trim()
      if (email !== undefined) updateData.email = email.trim().toLowerCase()
      if (role !== undefined) updateData.role = role
      if (position !== undefined) updateData.position = position
      if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl
      if (timezone !== undefined) updateData.timezone = timezone
      if (isActive !== undefined) updateData.isActive = isActive
      const [result] = await tx.update(users).set(updateData).where(eq(users.id, id)).returning()
      if (isActive === false || (role && role !== 'client')) await tx.update(clientUsers).set({ isActive: false, updatedAt: new Date() }).where(eq(clientUsers.userId, id))
      if (user.teamMemberId && (email !== undefined || fullName !== undefined || timezone !== undefined)) await tx.update(teamMembers).set({ ...(email !== undefined ? { email: updateData.email } : {}), ...(fullName !== undefined ? { name: updateData.fullName } : {}), ...(timezone !== undefined ? { timezone } : {}) }).where(eq(teamMembers.id, user.teamMemberId))
      return result
    })
    revokeUserSockets(id)
    const { password: _, ...safeUser } = updated
    res.json(safeUser)
  } catch (error: any) { res.status(error.status || (error.code === '23505' ? 409 : 500)).json({ error: error.code === '23505' ? 'Email or username is already used' : error.message || 'Failed to update user' }) }
})
router.put('/:id/password', (_req, res) => res.status(410).json({ error: 'Passwords are managed by Clerk. Use Forgot password on the sign-in page.' }))

router.post('/:id/invitation', async (req, res) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, Number(req.params.id)))
    if (!user) return res.status(404).json({ error: 'User not found' })
    await assertPortalAccount(user)
    if (!options.invitations && !process.env.CLERK_SECRET_KEY) return res.status(503).json({ error: 'Clerk is not configured. Configure it before generating invitations.' })
    const gateway = options.invitations || createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY }).invitations
    const invitation = await generateInvitationLink(user, gateway)
    res.json(invitation)
  } catch (error: any) { res.status(error.status || 502).json({ error: error.errors?.[0]?.longMessage || error.message || 'Unable to generate invitation link' }) }
})

// Assign user to client
router.post('/:userId/clients/:clientId', async (req, res) => {
  try {
    const { userId, clientId } = req.params
    const { accessLevel = 'read' } = req.body
    const assignedBy = req.user!.id
    if (!['read', 'write', 'admin'].includes(accessLevel)) return res.status(400).json({ error: 'Invalid access level' })

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
    if (accessLevel !== undefined && !['read', 'write', 'admin'].includes(accessLevel)) return res.status(400).json({ error: 'Invalid access level' })
    if (isActive !== undefined && typeof isActive !== 'boolean') return res.status(400).json({ error: 'Invalid assignment status' })

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

    revokeUserSockets(Number(userId))
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

    revokeUserSockets(Number(userId))
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
        clerkUserId: users.clerkUserId,
        authProvider: users.authProvider,
        timezone: users.timezone,
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

// Deactivation preserves all financial, employment and audit history.
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    await db.transaction(async tx => {
      await guardAdminChange(tx, id, req.user!.id, true)
      await tx.update(users).set({ isActive: false, updatedAt: new Date() }).where(eq(users.id, id))
      await tx.update(clientUsers).set({ isActive: false, updatedAt: new Date() }).where(eq(clientUsers.userId, id))
    })
    revokeUserSockets(id)
    res.json({ message: 'User deactivated; history retained' })
  } catch (error: any) { res.status(error.status || 500).json({ error: error.message || 'Unable to deactivate user' }) }
})

// Only an unused, unlinked account without references may be permanently removed.
router.delete('/:id/hard', async (req, res) => {
  try {
    const id = Number(req.params.id)
    await db.transaction(async tx => {
      const user = await guardAdminChange(tx, id, req.user!.id, true)
      if (user.teamMemberId || user.clerkUserId || user.googleId || user.lastLoginAt) throw Object.assign(new Error('This user has an identity or employee history. Deactivate the account instead.'), { status: 409 })
      const references = await tx.execute(sql`
        SELECT ns.nspname AS schema_name, rel.relname AS table_name, col.attname AS column_name
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace ns ON ns.oid = rel.relnamespace
        JOIN pg_attribute col ON col.attrelid = con.conrelid AND col.attnum = ANY(con.conkey)
        WHERE con.contype = 'f' AND con.confrelid = 'users'::regclass
      `)
      for (const row of references.rows as { schema_name: string; table_name: string; column_name: string }[]) {
        const quote = (value: string) => '"' + value.replace(/"/g, '""') + '"'
        const reference = sql.raw(`${quote(row.schema_name)}.${quote(row.table_name)}`)
        const column = sql.raw(quote(row.column_name))
        const related = await tx.execute(sql`SELECT 1 FROM ${reference} WHERE ${column} = ${id} LIMIT 1`)
        if (related.rows.length) throw Object.assign(new Error('This user has related records or audit history. Deactivate the account instead.'), { status: 409 })
      }
      await tx.delete(users).where(eq(users.id, id))
    })
    revokeUserSockets(id)
    res.json({ message: 'Unused account removed; no related records were deleted' })
  } catch (error: any) { res.status(error.status || (error.code === '23503' ? 409 : 500)).json({ error: error.code === '23503' ? 'This user has related records. Deactivate the account instead.' : error.message || 'Unable to remove user' }) }
})

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

return router
}

export default createUsersRouter()