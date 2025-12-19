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

