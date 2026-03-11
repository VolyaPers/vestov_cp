import { Router, type Request, type Response, type NextFunction } from 'express'
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import passport from 'passport'
import rateLimit from 'express-rate-limit'
import bcrypt from 'bcryptjs'
import { requireAuth } from '../middleware/auth.js'
import { db } from '../db/index.js'
import { users, teamMembers } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { createUserAccount } from '../services/userService.js'
import { getSlackAvatarByEmail } from '../utils/slack.js'
import type { UserWithoutPassword } from '../types/passport.js'

interface GoogleAuthInfo {
  message: string
  googleData?: {
    email: string
    fullName: string
    googleId: string
    avatarUrl: string | null
  }
}

interface RegisterRequestBody {
  firstName?: string
  lastName?: string
  email?: string
  password?: string
  role?: string
  googleId?: string
  avatarUrl?: string
}

interface ExchangeTokenRequestBody {
  token?: string
}

interface GoogleAuthHandoffPayload {
  userId: number
  exp: number
  nonce: string
}

const router = Router()

// Rate limiting for login attempts (disabled in development)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 5 : 1000, // Much higher limit for dev
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
})

const ALLOWED_ROLES = ['admin', 'client', 'team_member']
const GOOGLE_AUTH_HANDOFF_TTL_MS = 5 * 60 * 1000
const googleAuthHandoffTokenCache = new Map<string, number>()

function getSessionSecret() {
  return process.env.SESSION_SECRET || 'your-secret-key-change-in-production'
}

function cleanupGoogleAuthHandoffTokenCache() {
  const now = Date.now()
  for (const [tokenKey, expiresAt] of googleAuthHandoffTokenCache.entries()) {
    if (expiresAt <= now) {
      googleAuthHandoffTokenCache.delete(tokenKey)
    }
  }
}

function encodeGoogleOAuthState(frontendUrl: string): string {
  return Buffer.from(JSON.stringify({ frontendUrl }), 'utf8').toString('base64url')
}

function decodeGoogleOAuthState(state?: string): string | null {
  if (!state) {
    return null
  }

  try {
    const payload = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as { frontendUrl?: string }
    return normalizeFrontendOrigin(payload.frontendUrl)
  } catch {
    return null
  }
}

function createGoogleAuthHandoffToken(userId: number): string {
  const payload: GoogleAuthHandoffPayload = {
    userId,
    exp: Date.now() + GOOGLE_AUTH_HANDOFF_TTL_MS,
    nonce: randomUUID(),
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const signature = createHmac('sha256', getSessionSecret()).update(encodedPayload).digest('base64url')
  return `${encodedPayload}.${signature}`
}

function consumeGoogleAuthHandoffToken(token?: string): GoogleAuthHandoffPayload | null {
  if (!token) {
    return null
  }

  cleanupGoogleAuthHandoffTokenCache()

  const [encodedPayload, signature, ...rest] = token.split('.')
  if (!encodedPayload || !signature || rest.length > 0) {
    return null
  }

  const expectedSignature = createHmac('sha256', getSessionSecret()).update(encodedPayload).digest()
  const receivedSignature = Buffer.from(signature, 'base64url')

  if (receivedSignature.length !== expectedSignature.length || !timingSafeEqual(receivedSignature, expectedSignature)) {
    return null
  }

  let payload: GoogleAuthHandoffPayload
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as GoogleAuthHandoffPayload
  } catch {
    return null
  }

  if (!Number.isFinite(payload.userId) || !Number.isFinite(payload.exp) || payload.exp <= Date.now()) {
    return null
  }

  if (googleAuthHandoffTokenCache.has(signature)) {
    return null
  }

  googleAuthHandoffTokenCache.set(signature, payload.exp)
  return payload
}

// Register route (self-service signup or claim existing admin-created user)
router.post('/register', async (req, res) => {
  try {
    console.log('[REGISTER] Request received:', {
      method: req.method,
      path: req.path,
      origin: req.headers.origin,
      body: { firstName: req.body?.firstName, lastName: req.body?.lastName, email: req.body?.email, role: req.body?.role, hasPassword: !!req.body?.password, hasGoogleId: !!req.body?.googleId },
    })

    const body = req.body as RegisterRequestBody
    const { firstName, lastName, email, password, role, googleId, avatarUrl } = body || {}
    const isGoogleSignup = !!googleId

    console.log('[REGISTER] Processing registration for:', { email, role, isGoogleSignup })

    // For Google signup, password is optional
    if (!firstName || !lastName || !email || !role) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    if (!isGoogleSignup && !password) {
      return res.status(400).json({ error: 'Password is required for email/password registration' })
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid role selected' })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const username = normalizedEmail // login uses email/username
    const fullName = `${firstName} ${lastName}`.trim()

    // If a user already exists with this email/username, let them claim the account by setting a password.
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1)

    type UserResponse = {
      id: number
      username: string
      fullName: string
      email: string
      role: string
      position: string | null
      avatarUrl: string | null
      isActive: boolean
      teamMemberId: number | null
      clientId: number | null
    }

    let userResponse: UserResponse

    if (existing) {
      if (!existing.isActive) {
        return res.status(400).json({ error: 'Your account is inactive. Please contact an administrator as only administrators can reactivate inactive users.' })
      }

      // For existing users, password is required unless it's a Google account being linked
      if (!isGoogleSignup && !password) {
        return res.status(400).json({ error: 'Password is required to claim an existing account' })
      }

      const hashedPassword = password ? await bcrypt.hash(password, 12) : existing.password || ''
      const updateData: {
        password?: string
        fullName?: string
        username: string
        role: string
        position: string | null
        teamMemberId: number | null
        authProvider?: string
        googleId?: string
        avatarUrl?: string | null
        updatedAt: Date
        isActive: boolean
      } = {
        fullName: existing.fullName && existing.fullName.trim().length > 0 ? existing.fullName : fullName,
        username: existing.username,
        role: existing.role,
        position: existing.position,
        teamMemberId: existing.teamMemberId,
        updatedAt: new Date(),
        isActive: true,
      }

      if (isGoogleSignup) {
        // Link Google account
        if (googleId) {
          updateData.googleId = googleId
        }
        if (avatarUrl) {
          updateData.avatarUrl = avatarUrl
        }
        updateData.authProvider = 'google'
      } else {
        // Set password for local auth
        updateData.password = hashedPassword
        if (existing.authProvider === 'google') {
          updateData.authProvider = 'local'
        }
      }

      const [updated] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, existing.id))
        .returning()

      userResponse = {
        id: updated.id,
        username: updated.username,
        fullName: updated.fullName,
        email: updated.email,
        role: updated.role,
        position: updated.position,
        avatarUrl: updated.avatarUrl,
        isActive: updated.isActive,
        teamMemberId: updated.teamMemberId ?? null,
        clientId: null // Will be populated by deserializeUser on next request
      }

      // Auto-sync Slack avatar for non-Google signups if no avatar exists (async, don't wait for it)
      if (!isGoogleSignup && !updated.avatarUrl) {
        getSlackAvatarByEmail(normalizedEmail).then(async (slackAvatar) => {
          if (slackAvatar) {
            const slackAvatarUrl = slackAvatar.avatar192 || slackAvatar.avatar512 || slackAvatar.avatar72
            if (slackAvatarUrl) {
              try {
                await db.update(users).set({ avatarUrl: slackAvatarUrl }).where(eq(users.id, updated.id))
                if (updated.teamMemberId) {
                  await db.update(teamMembers).set({ avatarUrl: slackAvatarUrl }).where(eq(teamMembers.id, updated.teamMemberId))
                }
                console.log(`[SLACK] Auto-synced avatar for existing user claim: ${normalizedEmail}`)
              } catch (err) {
                console.error(`[SLACK] Failed to save avatar for existing user claim: ${normalizedEmail}`, err)
              }
            }
          }
        }).catch(err => {
          console.error(`[SLACK] Failed to fetch avatar for existing user claim: ${normalizedEmail}`, err)
        })
      }
    } else {
      const position =
        role === 'admin'
          ? 'Administrator'
          : role === 'team_member'
            ? 'Team Member'
            : 'Client'

      let teamMemberId: number | null = null
      if (role === 'team_member') {
        const [existingMember] = await db
          .select({ id: teamMembers.id })
          .from(teamMembers)
          .where(eq(teamMembers.email, normalizedEmail))
          .limit(1)

        if (existingMember) {
          teamMemberId = existingMember.id
        } else {
          const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD for date column
          const [createdMember] = await db
            .insert(teamMembers)
            .values({
              name: fullName,
              position: 'Team Member',
              email: normalizedEmail,
              startDate: today,
              status: 'active',
              isBillable: true,
            })
            .returning({ id: teamMembers.id })
          teamMemberId = createdMember.id
        }
      }

      const { user: newUser } = await createUserAccount({
        email: normalizedEmail,
        fullName,
        role: role as 'admin' | 'team_member' | 'client',
        username,
        password: isGoogleSignup ? undefined : password,
        position,
        teamMemberId: teamMemberId ?? undefined,
        avatarUrl: isGoogleSignup ? avatarUrl : undefined,
        source: isGoogleSignup ? 'google_register' : 'self_register',
      })

      // If Google signup, link the Google account
      let finalUser = newUser
      if (isGoogleSignup && googleId) {
        await db
          .update(users)
          .set({
            googleId,
            authProvider: 'google',
            updatedAt: new Date(),
          })
          .where(eq(users.id, newUser.id))

        // Refresh user data
        const [updatedUser] = await db
          .select()
          .from(users)
          .where(eq(users.id, newUser.id))
          .limit(1)

        if (updatedUser) {
          finalUser = updatedUser
        }
      }

      userResponse = {
        id: finalUser.id,
        username: finalUser.username,
        fullName: finalUser.fullName,
        email: finalUser.email,
        role: finalUser.role,
        position: finalUser.position,
        avatarUrl: finalUser.avatarUrl,
        isActive: finalUser.isActive,
        teamMemberId: teamMemberId ?? finalUser.teamMemberId ?? null,
        clientId: null // Default for new users, will be linked via clientUsers if needed
      }

      // Auto-sync Slack avatar for non-Google signups (async, don't wait for it)
      if (!isGoogleSignup && !finalUser.avatarUrl) {
        getSlackAvatarByEmail(normalizedEmail).then(async (slackAvatar) => {
          if (slackAvatar) {
            const slackAvatarUrl = slackAvatar.avatar192 || slackAvatar.avatar512 || slackAvatar.avatar72
            if (slackAvatarUrl) {
              try {
                await db.update(users).set({ avatarUrl: slackAvatarUrl }).where(eq(users.id, finalUser.id))
                if (teamMemberId) {
                  await db.update(teamMembers).set({ avatarUrl: slackAvatarUrl }).where(eq(teamMembers.id, teamMemberId))
                }
                console.log(`[SLACK] Auto-synced avatar for new registration: ${normalizedEmail}`)
              } catch (err) {
                console.error(`[SLACK] Failed to save avatar for new registration: ${normalizedEmail}`, err)
              }
            }
          }
        }).catch(err => {
          console.error(`[SLACK] Failed to fetch avatar for new registration: ${normalizedEmail}`, err)
        })
      }
    }

    // Auto-login after registration
    req.logIn(userResponse, (err) => {
      if (err) {
        console.error('[REGISTER] Session login error after register:', err)
        return res.status(500).json({ error: 'Registration succeeded but login failed' })
      }

      console.log('[REGISTER] New user registered successfully:', userResponse.email)
      console.log('[REGISTER] Sending response:', { status: 201, userId: userResponse.id, email: userResponse.email })

      // Set CORS headers explicitly
      const origin = req.headers.origin
      if (origin) {
        res.header('Access-Control-Allow-Origin', origin)
        res.header('Access-Control-Allow-Credentials', 'true')
      }

      return res.status(201).json({ user: userResponse })
    })
  } catch (error) {
    console.error('[REGISTER] Registration error:', error)
    const message =
      (error as Error)?.message || 'Failed to register user'

    // Set CORS headers explicitly on error
    const origin = req.headers.origin
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin)
      res.header('Access-Control-Allow-Credentials', 'true')
    }

    return res.status(500).json({ error: message })
  }
})

// Login route
router.post('/login', loginLimiter, (req, res, next) => {
  console.log(`[${new Date().toISOString()}] [LOGIN ROUTE] Login attempt for:`, req.body.username)
  console.log('[LOGIN ROUTE] Request body:', JSON.stringify(req.body, null, 2))
  passport.authenticate('local', (err: unknown, user: Express.User | false, info: { message?: string } | undefined) => {
    if (err) {
      console.error('Login error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }

    if (!user) {
      console.log('Login failed:', info?.message)
      return res.status(401).json({ error: info?.message || 'Invalid credentials' })
    }

    req.logIn(user, (err) => {
      if (err) {
        console.error('Session login error:', err)
        return res.status(500).json({ error: 'Login failed' })
      }

      console.log('Login successful for user:', user.username)
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
        }
      })
    })
  })(req, res, next)
})

// Logout route
router.post('/logout', requireAuth, (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' })
    }
    res.json({ message: 'Logged out successfully' })
  })
})

// Get current user
router.get('/user', (req, res) => {
  if (req.isAuthenticated() && req.user) {
    const user = req.user
    console.log('[GET /user] Session user object:', {
      id: user.id,
      email: user.email,
      role: user.role,
      originalUserId: user.originalUserId,
      originalEmail: user.originalEmail,
      hasOriginalUserId: !!user.originalUserId
    })
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

router.post('/auth/exchange', async (req, res) => {
  try {
    const body = req.body as ExchangeTokenRequestBody
    const payload = consumeGoogleAuthHandoffToken(body?.token)

    if (!payload) {
      return res.status(401).json({ error: 'Invalid or expired authentication token' })
    }

    const user = await loadAuthUserForSession(payload.userId)
    if (!user) {
      return res.status(401).json({ error: 'Authentication token is no longer valid' })
    }

    req.logIn(user, (err) => {
      if (err) {
        console.error('[GOOGLE OAUTH] Session exchange login error:', err)
        return res.status(500).json({ error: 'Failed to establish login session' })
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
    console.error('[GOOGLE OAUTH] Session exchange error:', error)
    return res.status(500).json({ error: 'Failed to exchange authentication token' })
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

    if (!targetUser) {
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

      console.log(`Super admin ${currentUser.email} impersonating ${targetUser.email}`)

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

    if (!originalUser) {
      return res.status(404).json({ error: 'Original user not found' })
    }

    req.logIn(originalUser, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to stop impersonation' })
      }

      console.log(`Stopped impersonating, returned to ${originalUser.email}`)

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

function normalizeAbsoluteUrl(value?: string | null): string | null {
  if (!value) {
    return null
  }

  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null
    }
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

function normalizeFrontendOrigin(value?: string | null): string | null {
  const normalizedUrl = normalizeAbsoluteUrl(value)
  if (!normalizedUrl) {
    return null
  }

  try {
    return new URL(normalizedUrl).origin
  } catch {
    return null
  }
}

function getFrontendUrl(): string {
  const frontendUrl = process.env.FRONTEND_URL || process.env.PUBLIC_APP_URL || 'http://localhost:5173'
  const normalizedUrl = frontendUrl.endsWith('/') ? frontendUrl.slice(0, -1) : frontendUrl
  console.log('[GOOGLE OAUTH] Frontend URL (raw):', frontendUrl)
  console.log('[GOOGLE OAUTH] Frontend URL (normalized):', normalizedUrl)
  console.log('[GOOGLE OAUTH] Environment variables:', {
    FRONTEND_URL: process.env.FRONTEND_URL,
    PUBLIC_APP_URL: process.env.PUBLIC_APP_URL,
    NODE_ENV: process.env.NODE_ENV,
  })
  return normalizedUrl
}

function getRequestedFrontendUrl(req: Request): string {
  const stateFrontendUrl = decodeGoogleOAuthState(
    typeof req.query.state === 'string' ? req.query.state : undefined
  )
  const queryFrontendUrl = normalizeFrontendOrigin(
    typeof req.query.frontend_origin === 'string' ? req.query.frontend_origin : undefined
  )
  const refererOrigin = normalizeFrontendOrigin(req.get('referer'))

  return stateFrontendUrl || queryFrontendUrl || refererOrigin || getFrontendUrl()
}

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

function handleGoogleOAuthInit(req: Request, res: Response, next: NextFunction) {
  const googleClientId = process.env.GOOGLE_CLIENT_ID
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!googleClientId || !googleClientSecret) {
    return res.status(503).json({ error: 'Google OAuth is not configured' })
  }

  const frontendUrl = getRequestedFrontendUrl(req)

  console.log('[GOOGLE OAUTH] Init request URLs:', {
    frontendUrl,
    referer: req.get('referer'),
  })

  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state: encodeGoogleOAuthState(frontendUrl),
  })(req, res, next)
}

router.get('/google', handleGoogleOAuthInit)
router.get('/auth/google', handleGoogleOAuthInit)

router.get('/google/callback', (req, res, next) => {
  const frontendUrl = getRequestedFrontendUrl(req)

  if (!frontendUrl || frontendUrl === 'http://localhost:5173') {
    console.error('[GOOGLE OAUTH] WARNING: Frontend URL not properly configured! Using fallback.')
  }

  passport.authenticate('google', {
    failureRedirect: `${frontendUrl}/?error=google_auth_failed`,
    session: true,
  }, (err: unknown, user: Express.User | false, info?: GoogleAuthInfo) => {
    if (err) {
      const error = err as Error
      console.error('[GOOGLE OAUTH] Authentication error:', error.message)
      console.error('[GOOGLE OAUTH] Error stack:', error.stack)

      const errorMessage = error.message || 'Authentication failed'
      const errorParam = error.message.includes('inactive')
        ? 'google_auth_inactive'
        : 'google_auth_error'
      const errorUrl = `${frontendUrl}/?error=${errorParam}&message=${encodeURIComponent(errorMessage)}`
      console.log('[GOOGLE OAUTH] Redirecting to error URL:', errorUrl)
      console.log('[GOOGLE OAUTH] Frontend URL validation:', {
        url: frontendUrl,
        isValid: frontendUrl.startsWith('http://') || frontendUrl.startsWith('https://'),
        isLocalhost: frontendUrl.includes('localhost'),
      })
      return res.redirect(errorUrl)
    }

    if (!user) {
      const errorMessage = info?.message || 'Authentication failed'
      console.error('[GOOGLE OAUTH] No user returned:', errorMessage)
      console.log('[GOOGLE OAUTH] Info object:', JSON.stringify(info, null, 2))

      // Check if user doesn't exist (needs registration)
      if (errorMessage === 'USER_NOT_FOUND' && info?.googleData) {
        const googleData = info.googleData
        console.log(`[GOOGLE OAUTH] User not found (${googleData.email}), redirecting to registration flow`)
        const registerUrl = `${frontendUrl}/?google_signup=1&email=${encodeURIComponent(googleData.email)}&name=${encodeURIComponent(googleData.fullName)}&avatar=${encodeURIComponent(googleData.avatarUrl || '')}&googleId=${encodeURIComponent(googleData.googleId || '')}`
        console.log('[GOOGLE OAUTH] Registration URL:', registerUrl)
        return res.redirect(registerUrl)
      }

      console.log('[GOOGLE OAUTH] Not a USER_NOT_FOUND case, treating as regular error')

      const errorParam = errorMessage.includes('inactive')
        ? 'google_auth_inactive'
        : 'google_auth_failed'
      const errorUrl = `${frontendUrl}/?error=${errorParam}&message=${encodeURIComponent(errorMessage)}`
      console.log('[GOOGLE OAUTH] Redirecting to error URL:', errorUrl)
      console.log('[GOOGLE OAUTH] Frontend URL validation:', {
        url: frontendUrl,
        isValid: frontendUrl.startsWith('http://') || frontendUrl.startsWith('https://'),
        isLocalhost: frontendUrl.includes('localhost'),
      })
      return res.redirect(errorUrl)
    }

    console.log('[GOOGLE OAUTH] User exists, creating frontend session handoff for:', user.email)
    const handoffToken = createGoogleAuthHandoffToken(user.id)
    const redirectUrl = new URL(frontendUrl)
    redirectUrl.pathname = '/'
    redirectUrl.search = ''
    redirectUrl.hash = ''
    redirectUrl.searchParams.set('auth_token', handoffToken)

    console.log(`[GOOGLE OAUTH] Successful login for ${user.email} (role: ${user.role}), redirecting to ${redirectUrl.toString()}`)
    console.log('[GOOGLE OAUTH] User object:', JSON.stringify({ id: user.id, email: user.email, role: user.role }, null, 2))
    return res.redirect(redirectUrl.toString())
  })(req, res, next)
})

export { router as authRouter }
