import { Router, type Request } from 'express'
import { createClerkClient, verifyToken } from '@clerk/backend'
import rateLimit from 'express-rate-limit'
import { requireAuth } from '../middleware/auth.js'
import { db } from '../db/index.js'
import { users, teamMembers } from '../db/schema.js'
import { and, eq, isNull, or } from 'drizzle-orm'
import type { UserWithoutPassword } from '../types/passport.js'
import { revokeSessionSockets } from '../socket.js'

interface ClerkUserSummary {
  id: string
  fullName: string | null
  imageUrl: string
  primaryEmailAddressId: string | null
  emailAddresses: Array<{
    id: string
    emailAddress: string
    verification?: { status: string }
  }>
}

class AuthRouteError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message)
    this.name = 'AuthRouteError'
  }
}

const router = Router()

const loginLimiter = rateLimit({ windowMs:15*60*1000, max:30, standardHeaders:true, legacyHeaders:false })
function normalizeFrontendOrigin(value?: string | null): string | null {
  if (!value) return null
  try { const url=new URL(value); return ['http:','https:'].includes(url.protocol)?url.origin:null } catch { return null }
}

function getClerkSecretKey(): string {
  const secretKey = process.env.CLERK_SECRET_KEY

  if (!secretKey) {
    throw new AuthRouteError(500, 'CLERK_SECRET_KEY is not configured on the API server.')
  }

  return secretKey
}

function getClerkClient() {
  return createClerkClient({
    secretKey: getClerkSecretKey(),
  })
}

function getClerkAuthorizedParties(): string[] | undefined {
  const parties = [
    process.env.PUBLIC_APP_URL,
    process.env.FRONTEND_URL,
    process.env.CORS_ORIGIN,
  ]
    .map((value) => normalizeFrontendOrigin(value))
    .filter((value): value is string => Boolean(value))

  return parties.length > 0 ? Array.from(new Set(parties)) : undefined
}

function extractBearerToken(req: Request): string | null {
  const authorizationHeader = req.get('authorization')
  if (!authorizationHeader) {
    return null
  }

  const [scheme, token] = authorizationHeader.split(/\s+/, 2)
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
    return null
  }

  return token
}

function getPrimaryClerkEmail(clerkUser: ClerkUserSummary): string | null {
  if (!clerkUser.emailAddresses.length) {
    return null
  }

  const primaryEmail =
    clerkUser.emailAddresses.find((email) => email.id === clerkUser.primaryEmailAddressId) ||
    clerkUser.emailAddresses[0]

  return primaryEmail?.verification?.status === 'verified' ? primaryEmail.emailAddress.trim().toLowerCase() : null
}

export async function syncLocalUserWithClerk(clerkUser: ClerkUserSummary): Promise<number> {
  const clerkEmail = getPrimaryClerkEmail(clerkUser)

  if (!clerkEmail) {
    throw new AuthRouteError(400, 'Your Clerk account does not have a primary email address.')
  }

  const [existingLinkedUser] = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, clerkUser.id))
    .limit(1)

  const matchedUser = existingLinkedUser
    ? existingLinkedUser
    : await db
        .select()
        .from(users)
        .where(eq(users.email, clerkEmail))
        .limit(1)
        .then((rows) => rows[0] ?? null)

  if (!matchedUser) {
    throw new AuthRouteError(
      403,
      'No Vestov Hub account is linked to this Clerk email yet. Ask an administrator to create or connect your account first.',
    )
  }

  if (!matchedUser.isActive) {
    throw new AuthRouteError(
      403,
      'Your account is inactive. Please contact an administrator as only administrators can reactivate inactive users.',
    )
  }

  if (matchedUser.clerkUserId && matchedUser.clerkUserId !== clerkUser.id) {
    throw new AuthRouteError(
      409,
      'This Vestov Hub account is already linked to a different Clerk identity.',
    )
  }

  const [updatedUser] = await db
    .update(users)
    .set({
      clerkUserId: clerkUser.id,
      authProvider: 'clerk',
      avatarUrl: matchedUser.avatarUrl || clerkUser.imageUrl || null,
      fullName: matchedUser.fullName || clerkUser.fullName || clerkEmail,
      lastLoginAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(users.id, matchedUser.id), eq(users.isActive, true), eq(users.email, matchedUser.email),
      or(isNull(users.clerkUserId), eq(users.clerkUserId, clerkUser.id))))
    .returning({ id: users.id })

  if (!updatedUser) throw new AuthRouteError(409, 'The account changed while signing in. Retry with its currently authorized Clerk identity.')
  return updatedUser.id
}

router.post(['/register', '/login'], loginLimiter, (_req, res) => {
  res.status(410).json({ error: 'Password access is managed by Clerk. Sign in with your authorized Clerk account.' })
})

// Logout route
router.post('/logout', requireAuth, (req, res) => {
  revokeSessionSockets(req.sessionID)
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' })
    }
    req.session.destroy((error) => {
      if (error) return res.status(500).json({ error: 'Failed to end session' })
      res.clearCookie('vestov.sid', { path: '/' }).json({ message: 'Logged out successfully' })
    })
  })
})

// Get current user
router.get('/user', (req, res) => {
  if (req.isAuthenticated() && req.user) {
    const user = req.user
    res.json({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      position: user.position,
      avatarUrl: user.avatarUrl,
      isActive: user.isActive,
      isImpersonating: user.originalUserId ? true : false,
      originalUser: user.originalUserId ? {
        id: user.originalUserId,
        username: user.originalUsername,
        email: user.originalEmail
      } : null
    })
  } else {
    res.status(401).json({ error: 'Not authenticated' })
  }
})

router.post('/auth/clerk/sync', async (req, res) => {
  try {
    const token = extractBearerToken(req)
    if (!token) {
      throw new AuthRouteError(401, 'Missing Clerk session token.')
    }

    let tokenPayload: Awaited<ReturnType<typeof verifyToken>>

    try {
      tokenPayload = await verifyToken(token, {
        secretKey: getClerkSecretKey(),
        authorizedParties: getClerkAuthorizedParties(),
      })
    } catch (error) {
      console.error('[CLERK SYNC] Token verification failed')
      throw new AuthRouteError(401, 'Invalid or expired Clerk session token.')
    }

    if (!tokenPayload.sub) {
      throw new AuthRouteError(401, 'Clerk token did not include a user identifier.')
    }

    const clerkUser = await getClerkClient().users.getUser(tokenPayload.sub) as ClerkUserSummary
    const localUserId = await syncLocalUserWithClerk(clerkUser)
    const user = await loadAuthUserForSession(localUserId)

    if (!user) {
      throw new AuthRouteError(403, 'No active Vestov Hub account could be loaded for this Clerk user.')
    }

    req.logIn(user, (err) => {
      if (err) {
        console.error('[CLERK SYNC] Session login failed')
        return res.status(500).json({ error: 'Failed to establish a Vestov Hub session.' })
      }

      return res.json({
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          position: user.position,
          avatarUrl: user.avatarUrl,
          isActive: user.isActive,
        },
      })
    })
  } catch (error) {
    if (error instanceof AuthRouteError) {
      return res.status(error.statusCode).json({ error: error.message })
    }

    console.error('[CLERK SYNC] Unexpected error:', error instanceof Error ? error.name : 'Unknown error')
    return res.status(500).json({ error: 'Failed to synchronize the Clerk session.' })
  }
})

// Impersonate user (admin-level accounts)
router.post('/impersonate/:userId', requireAuth, async (req, res) => {
  try {
    const currentUser = req.user

    // Only allow admins to impersonate
    if (currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can impersonate users' })
    }

    // Don't allow impersonating while already impersonating
    if (currentUser.originalUserId) {
      return res.status(400).json({ error: 'Already impersonating a user. Stop impersonation first.' })
    }

    const targetUserId = parseInt(req.params.userId)

    // Get target user
    const [targetUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, targetUserId))

    if (!targetUser || !targetUser.isActive) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Don't allow impersonating self
    if (targetUser.id === currentUser.id) {
      return res.status(400).json({ error: 'Cannot impersonate yourself' })
    }

    // If target is a team member, get avatar from team_members table via foreign key
    let avatarUrl = targetUser.avatarUrl
    if (targetUser.role === 'team_member' && targetUser.teamMemberId) {
      const [teamMember] = await db
        .select({ avatarUrl: teamMembers.avatarUrl })
        .from(teamMembers)
        .where(eq(teamMembers.id, targetUser.teamMemberId))
        .limit(1)

      if (teamMember && teamMember.avatarUrl) {
        avatarUrl = teamMember.avatarUrl
      }
    }

    // Store original user info in session and switch to target user
    const impersonatedUser = {
      ...targetUser,
      avatarUrl,  // Use the avatar from team_members if available
      originalUserId: currentUser.id,
      originalUsername: currentUser.username,
      originalEmail: currentUser.email
    }

    req.logIn(impersonatedUser, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Impersonation failed' })
      }

      console.info('[AUTH] Impersonation started', { actorId: currentUser.id, targetId: targetUser.id })

      res.json({
        message: 'Impersonation started',
        user: {
          id: targetUser.id,
          username: targetUser.username,
          fullName: targetUser.fullName,
          email: targetUser.email,
          role: targetUser.role,
          position: targetUser.position,
          isImpersonating: true,
          originalUser: {
            id: currentUser.id,
            username: currentUser.username,
            email: currentUser.email
          }
        }
      })
    })
  } catch (error) {
    console.error('Error impersonating user:', error)
    res.status(500).json({ error: 'Failed to impersonate user' })
  }
})

// Stop impersonation and return to original user
router.post('/stop-impersonation', requireAuth, async (req, res) => {
  try {
    const currentUser = req.user

    if (!currentUser.originalUserId) {
      return res.status(400).json({ error: 'Not currently impersonating' })
    }

    // Get original user
    const [originalUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, currentUser.originalUserId))

    if (!originalUser || !originalUser.isActive || originalUser.role !== 'admin') {
      return res.status(404).json({ error: 'Original user not found' })
    }

    req.logIn(originalUser, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to stop impersonation' })
      }

      console.info('[AUTH] Impersonation stopped', { actorId: originalUser.id })

      res.json({
        message: 'Impersonation stopped',
        user: {
          id: originalUser.id,
          username: originalUser.username,
          fullName: originalUser.fullName,
          email: originalUser.email,
          role: originalUser.role,
          position: originalUser.position,
          isImpersonating: false
        }
      })
    })
  } catch (error) {
    console.error('Error stopping impersonation:', error)
    res.status(500).json({ error: 'Failed to stop impersonation' })
  }
})

async function loadAuthUserForSession(userId: number): Promise<UserWithoutPassword | null> {
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      email: users.email,
      role: users.role,
      position: users.position,
      avatarUrl: users.avatarUrl,
      teamMemberId: users.teamMemberId,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user || !user.isActive) {
    return null
  }

  let avatarUrl = user.avatarUrl
  if (user.role === 'team_member' && user.teamMemberId) {
    const [teamMember] = await db
      .select({ avatarUrl: teamMembers.avatarUrl })
      .from(teamMembers)
      .where(eq(teamMembers.id, user.teamMemberId))
      .limit(1)

    if (teamMember?.avatarUrl) {
      avatarUrl = teamMember.avatarUrl
    }
  }

  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    position: user.position,
    avatarUrl,
    isActive: user.isActive,
    teamMemberId: user.teamMemberId,
  }
}


router.all(['/auth/exchange','/google','/auth/google','/google/callback'], (_req,res)=>{res.status(410).json({error:'Use Clerk sign in.'})})
export { router as authRouter }
