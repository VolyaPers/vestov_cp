import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { clientUsers, teamMembers, users } from '../db/schema.js'

const normalizeEmail = (email: string) => email.trim().toLowerCase()
const normalizeUsername = (username: string) => username.trim().toLowerCase()

type UserRole = 'admin' | 'team_member' | 'client'

interface CreateUserOptions {
  email: string
  fullName: string
  role: UserRole
  username?: string
  password?: string
  position?: string
  avatarUrl?: string
  teamMemberId?: number
  createdBy?: number | null
  source?: string
  isActive?: boolean
}

interface CreateUserResult {
  user: typeof users.$inferSelect
}

export async function createUserAccount(
  options: CreateUserOptions
): Promise<CreateUserResult> {
  const {
    email,
    fullName,
    role,
    username,
    password,
    position,
    avatarUrl,
    teamMemberId,
    createdBy,
    source = 'admin_create',
    isActive = true,
  } = options

  const normalizedEmail = normalizeEmail(email)
  const normalizedUsername = normalizeUsername(username || normalizedEmail)

  return db.transaction(async (tx) => {
    // Check for existing user - this should only find users that weren't hard-deleted
    // If a user was hard-deleted, they should be completely removed from the database
    const [existingUser] = await tx
      .select()
      .from(users)
      .where(
        sql`(${users.email} = ${normalizedEmail} OR ${users.username} = ${normalizedUsername})`
      )
      .limit(1)

    if (existingUser) {
      const conflictField = existingUser.email === normalizedEmail ? 'email' : 'username'
      const conflictValue = conflictField === 'email' ? normalizedEmail : normalizedUsername
      console.error(`[CREATE USER] Conflict: User ID ${existingUser.id} already exists with ${conflictField} "${conflictValue}"`)
      console.error(`[CREATE USER] Existing user details: ID=${existingUser.id}, email=${existingUser.email}, username=${existingUser.username}, isActive=${existingUser.isActive}`)
      throw new Error(`${conflictField === 'email' ? 'Email' : 'Username'} "${conflictValue}" is already in use by another user`)
    }

    if (teamMemberId) {
      const [teamMember] = await tx
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.id, Number(teamMemberId)))
        .limit(1)

      if (!teamMember) {
        throw new Error('Selected team member not found')
      }

      const [existingTeamUser] = await tx
        .select()
        .from(users)
        .where(eq(users.teamMemberId, Number(teamMemberId)))
        .limit(1)

      if (existingTeamUser) {
        throw new Error('This team member already has a user account')
      }
    }

    const hashedPassword = await bcrypt.hash(
      password && password.length > 0 ? password : crypto.randomUUID(),
      12
    )

    const [newUser] = await tx
      .insert(users)
      .values({
        username: normalizedUsername,
        password: hashedPassword,
        fullName,
        email: normalizedEmail,
        role,
        position,
        avatarUrl,
        teamMemberId: teamMemberId ?? null,
        isActive,
        authProvider: 'local',
      })
      .returning()

    return { user: newUser }
  })
}

export async function deactivateUserAndMemberships(userId: number) {
  const now = new Date()
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ isActive: false, updatedAt: now })
      .where(eq(users.id, userId))

    await tx
      .update(clientUsers)
      .set({ isActive: false, updatedAt: now })
      .where(eq(clientUsers.userId, userId))
  })
}

interface LinkOrCreateUserOptions {
  email: string
  fullName: string
  googleId: string
  avatarUrl?: string | null
  role?: UserRole
  username?: string
  position?: string
  teamMemberId?: number
}

interface LinkOrCreateUserResult {
  user: typeof users.$inferSelect
  wasLinked: boolean
}

export async function linkOrCreateUserAccount(
  options: LinkOrCreateUserOptions
): Promise<LinkOrCreateUserResult> {
  const {
    email,
    fullName,
    googleId,
    avatarUrl,
    role = 'client',
    username,
    position,
    teamMemberId,
  } = options

  const normalizedEmail = normalizeEmail(email)
  const normalizedUsername = normalizeUsername(username || normalizedEmail)

  return db.transaction(async (tx) => {
    const [existingUser] = await tx
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1)

    if (existingUser) {
      if (!existingUser.isActive) {
        throw new Error('Your account is inactive. Please contact an administrator as only administrators can reactivate inactive users.')
      }

      if (existingUser.googleId) {
        if (existingUser.googleId !== googleId) {
          throw new Error('This email is already linked to a different Google account.')
        }
        
        const [updated] = await tx
          .update(users)
          .set({
            lastLoginAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(users.id, existingUser.id))
          .returning()
        return { user: updated, wasLinked: true }
      }

      const updateData: {
        googleId: string
        authProvider: string
        fullName?: string
        avatarUrl?: string | null
        lastLoginAt?: Date
        updatedAt: Date
      } = {
        googleId,
        authProvider: existingUser.authProvider === 'local' ? 'local' : 'google',
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      }

      if (!existingUser.fullName || existingUser.fullName.trim().length === 0) {
        updateData.fullName = fullName
      }

      if (!existingUser.avatarUrl && avatarUrl) {
        updateData.avatarUrl = avatarUrl
      }

      const [updated] = await tx
        .update(users)
        .set(updateData)
        .where(eq(users.id, existingUser.id))
        .returning()

      return { user: updated, wasLinked: true }
    }

    let finalRole = role
    let finalPosition = position
    let finalTeamMemberId = teamMemberId

    if (finalRole === 'team_member') {
      const [existingMember] = await tx
        .select({ id: teamMembers.id })
        .from(teamMembers)
        .where(eq(teamMembers.email, normalizedEmail))
        .limit(1)

      if (existingMember) {
        finalTeamMemberId = existingMember.id
      } else {
        const today = new Date().toISOString().slice(0, 10)
        const [createdMember] = await tx
          .insert(teamMembers)
          .values({
            name: fullName,
            role: 'team_member',
            email: normalizedEmail,
            startDate: today,
            status: 'active',
            isBillable: true,
          })
          .returning({ id: teamMembers.id })
        finalTeamMemberId = createdMember.id
      }
    }

    if (!finalPosition) {
      finalPosition =
        finalRole === 'admin'
          ? 'Administrator'
          : finalRole === 'team_member'
            ? 'Team Member'
            : 'Client'
    }

    const [newUser] = await tx
      .insert(users)
      .values({
        username: normalizedUsername,
        password: null,
        fullName,
        email: normalizedEmail,
        role: finalRole,
        position: finalPosition,
        avatarUrl: avatarUrl ?? null,
        teamMemberId: finalTeamMemberId ?? null,
        googleId,
        authProvider: 'google',
        isActive: true,
        lastLoginAt: new Date(),
      })
      .returning()

    return { user: newUser, wasLinked: false }
  })
}


