import { Router, type Request, type Response, type NextFunction } from 'express'
import passport from 'passport'
import rateLimit from 'express-rate-limit'
import bcrypt from 'bcryptjs'
import { requireAuth } from '../middleware/auth.js'
import { db } from '../db/index.js'
import { users, teamMembers } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { createUserAccount } from '../services/userService.js'

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

// Register route (self-service signup or claim existing admin-created user)
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, role } = req.body || {}

    if (!firstName || !lastName || !email || !password || !role) {
      return res.status(400).json({ error: 'Missing required fields' })
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
    }

    let userResponse: UserResponse

    if (existing) {
      if (!existing.isActive) {
        return res.status(400).json({ error: 'Account is inactive. Please contact an administrator.' })
      }

      const hashedPassword = await bcrypt.hash(password, 12)
      const updateData: {
        password: string
        fullName?: string
        username: string
        role: string
        position: string | null
        teamMemberId: number | null
        authProvider?: string
        updatedAt: Date
        isActive: boolean
      } = {
        password: hashedPassword,
        fullName: existing.fullName && existing.fullName.trim().length > 0 ? existing.fullName : fullName,
        username: existing.username,
        role: existing.role,
        position: existing.position,
        teamMemberId: existing.teamMemberId,
        updatedAt: new Date(),
        isActive: true,
      }

      if (existing.authProvider === 'google') {
        updateData.authProvider = 'local'
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
              role: 'team_member',
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
        role,
        username,
        password,
        position,
        teamMemberId: teamMemberId ?? undefined,
        source: 'self_register',
      })

      userResponse = {
        id: newUser.id,
        username: newUser.username,
        fullName: newUser.fullName,
        email: newUser.email,
        role: newUser.role,
        position: newUser.position,
        avatarUrl: newUser.avatarUrl,
        isActive: newUser.isActive,
        teamMemberId: teamMemberId ?? newUser.teamMemberId ?? null,
      }
    }

    // Auto-login after registration
    req.logIn(userResponse, (err) => {
      if (err) {
        console.error('Session login error after register:', err)
        return res.status(500).json({ error: 'Registration succeeded but login failed' })
      }

      console.log('New user registered:', userResponse.email)
      return res.status(201).json({ user: userResponse })
    })
  } catch (error) {
    console.error('Registration error:', error)
    const message =
      (error as Error)?.message || 'Failed to register user'
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

function getFrontendUrl(): string {
  return process.env.FRONTEND_URL || process.env.PUBLIC_APP_URL || 'http://localhost:5173'
}

function handleGoogleOAuthInit(req: Request, res: Response, next: NextFunction) {
  const googleClientId = process.env.GOOGLE_CLIENT_ID
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!googleClientId || !googleClientSecret) {
    return res.status(503).json({ error: 'Google OAuth is not configured' })
  }

  passport.authenticate('google', {
    scope: ['profile', 'email']
  })(req, res, next)
}

router.get('/google', handleGoogleOAuthInit)
router.get('/auth/google', handleGoogleOAuthInit)

router.get('/google/callback', (req, res, next) => {
  const frontendUrl = getFrontendUrl()
  
  passport.authenticate('google', {
    failureRedirect: `${frontendUrl}/?error=google_auth_failed`,
    session: true
  }, (err: unknown, user: Express.User | false) => {
    if (err) {
      console.error('[GOOGLE OAUTH] Authentication error:', err)
      return res.redirect(`${frontendUrl}/?error=google_auth_error`)
    }

    if (!user) {
      return res.redirect(`${frontendUrl}/?error=google_auth_failed`)
    }

    req.logIn(user, (loginErr) => {
      if (loginErr) {
        console.error('[GOOGLE OAUTH] Session login error:', loginErr)
        return res.redirect(`${frontendUrl}/?error=google_auth_session_failed`)
      }

      const redirectPath = user.role === 'admin'
        ? '/admin/dashboard'
        : user.role === 'team_member'
          ? '/employee/dashboard'
          : '/client'

      const fullRedirectUrl = `${frontendUrl}${redirectPath}`

      console.log(`[GOOGLE OAUTH] Successful login for ${user.email}, redirecting to ${fullRedirectUrl}`)
      res.redirect(fullRedirectUrl)
    })
  })(req, res, next)
})

export { router as authRouter }