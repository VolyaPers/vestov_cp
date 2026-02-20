import passport from 'passport'
import { Strategy as LocalStrategy } from 'passport-local'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import bcrypt from 'bcryptjs'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql } from 'drizzle-orm'
import { eq, and } from 'drizzle-orm'
import { users, teamMembers } from '../db/schema.js'
import * as schema from '../db/schema.js'
import type { UserWithPassword, UserWithoutPassword, SessionData, UserWithImpersonation } from '../types/passport.js'

interface GoogleAuthInfo {
  message: string
  googleData?: {
    email: string
    fullName: string
    googleId: string
    avatarUrl: string | null
  }
}

export function setupPassport(pool: Pool) {
  const db = drizzle(pool, { schema })

  // Local Strategy
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        let user: UserWithPassword | null = null

        try {
          const [selectedUser] = await db
            .select({
              id: users.id,
              username: users.username,
              password: users.password,
              fullName: users.fullName,
              email: users.email,
              role: users.role,
              position: users.position,
              avatarUrl: users.avatarUrl,
              isActive: users.isActive,
            })
            .from(users)
            .where(
              sql`${users.username} = ${username} OR ${users.email} = ${username}`
            )
            .limit(1)
          user = selectedUser || null
        } catch (selectError) {
          const err = selectError as Error
          if (err.message && err.message.includes('is_active')) {
            console.log('[PASSPORT] is_active column not found, using raw SQL fallback')
            const result = await pool.query<UserWithPassword>(`
              SELECT id, username, password, full_name as "fullName", email, role, position, avatar_url as "avatarUrl", true as "isActive"
              FROM users
              WHERE username = $1 OR email = $1
              LIMIT 1
            `, [username])
            user = result.rows[0] || null
          } else {
            throw selectError
          }
        }

        if (!user) {
          return done(null, false, { message: 'Invalid username or password' })
        }

        if (!user.password) {
          return done(null, false, { message: 'This account uses Google sign-in. Please sign in with Google.' })
        }

        const isValidPassword = await bcrypt.compare(password, user.password)
        if (!isValidPassword) {
          return done(null, false, { message: 'Invalid username or password' })
        }

        if (user.isActive === false) {
          return done(null, false, { message: 'Your account is inactive. Please contact an administrator as only administrators can reactivate inactive users.' })
        }

        const { password: _, ...userWithoutPassword } = user
        return done(null, userWithoutPassword as UserWithoutPassword)
      } catch (error) {
        return done(error)
      }
    })
  )

  const googleClientId = process.env.GOOGLE_CLIENT_ID
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET
  const backendURL = process.env.BACKEND_URL || process.env.PUBLIC_APP_URL || 'http://localhost:3001'
  const googleCallbackURL = process.env.GOOGLE_CALLBACK_URL || `${backendURL}/api/google/callback`

  if (googleClientId && googleClientSecret) {
    console.log('[PASSPORT] Google OAuth configured with callback:', googleCallbackURL)
  }

  if (googleClientId && googleClientSecret) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: googleClientId,
          clientSecret: googleClientSecret,
          callbackURL: googleCallbackURL,
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            if (!profile.emails || profile.emails.length === 0) {
              return done(new Error('Google account does not have an email address'))
            }

            const email = profile.emails[0].value
            const fullName = profile.displayName || `${profile.name?.givenName || ''} ${profile.name?.familyName || ''}`.trim() || email
            const googleId = profile.id
            const avatarUrl = profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null

            // Check if user exists first
            const normalizedEmail = email.trim().toLowerCase()
            console.log('[GOOGLE OAUTH] Checking for existing user with email:', normalizedEmail)
            const [existingUser] = await db
              .select()
              .from(users)
              .where(eq(users.email, normalizedEmail))
              .limit(1)

            console.log('[GOOGLE OAUTH] User lookup result:', existingUser ? `Found user ID ${existingUser.id}` : 'User not found')
            console.log('[GOOGLE OAUTH] DEBUG - existingUser is:', existingUser ? 'truthy' : 'falsy')
            console.log('[GOOGLE OAUTH] DEBUG - typeof existingUser:', typeof existingUser)

            if (!existingUser) {
              // User doesn't exist - signal that registration is needed
              // Pass Google profile data so frontend can use it for registration
              console.log('[GOOGLE OAUTH] ===== USER NOT FOUND - RETURNING USER_NOT_FOUND =====')
              console.log('[GOOGLE OAUTH] Email:', email)
              console.log('[GOOGLE OAUTH] Google ID:', googleId)
              const authInfo = {
                message: 'USER_NOT_FOUND',
                googleData: {
                  email,
                  fullName,
                  googleId,
                  avatarUrl
                }
              }
              console.log('[GOOGLE OAUTH] Auth info being returned:', JSON.stringify(authInfo, null, 2))
              return done(null, false, authInfo)
            }

            console.log('[GOOGLE OAUTH] ===== USER EXISTS - PROCEEDING WITH LOGIN =====')
            console.log('[GOOGLE OAUTH] User ID:', existingUser.id)
            console.log('[GOOGLE OAUTH] User email:', existingUser.email)

            // User exists - proceed with linking/updating
            if (!existingUser.isActive) {
              return done(null, false, { message: 'Your account is inactive. Please contact an administrator as only administrators can reactivate inactive users.' })
            }

            // Link Google account if not already linked
            const updateData: {
              googleId?: string
              authProvider?: string
              fullName?: string
              avatarUrl?: string | null
              lastLoginAt?: Date
              updatedAt: Date
            } = {
              updatedAt: new Date(),
              lastLoginAt: new Date(),
            }

            if (!existingUser.googleId) {
              updateData.googleId = googleId
              updateData.authProvider = existingUser.authProvider === 'local' ? 'local' : 'google'
            } else if (existingUser.googleId !== googleId) {
              return done(null, false, { message: 'This email is already linked to a different Google account.' })
            }

            if (!existingUser.fullName || existingUser.fullName.trim().length === 0) {
              updateData.fullName = fullName
            }

            if (!existingUser.avatarUrl && avatarUrl) {
              updateData.avatarUrl = avatarUrl
            }

            const [updatedUser] = await db
              .update(users)
              .set(updateData)
              .where(eq(users.id, existingUser.id))
              .returning()

            const { password: _, ...userWithoutPassword } = updatedUser
            return done(null, userWithoutPassword as UserWithoutPassword)
          } catch (error) {
            console.error('[GOOGLE OAUTH] Error during authentication:', error)
            return done(error)
          }
        }
      )
    )
  } else {
    console.warn('[PASSPORT] Google OAuth credentials not configured. Google sign-in will be disabled.')
  }

  passport.serializeUser((user, done) => {
    const userData = user as UserWithoutPassword & Partial<UserWithImpersonation>
    const sessionData: SessionData = {
      id: userData.id,
      originalUserId: userData.originalUserId,
      originalUsername: userData.originalUsername,
      originalEmail: userData.originalEmail
    }
    done(null, sessionData)
  })

  passport.deserializeUser(async (sessionData, done) => {
    try {
      const data = sessionData as SessionData | number
      const userId = typeof data === 'number' ? data : data.id

      const [user] = await db
        .select({
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          email: users.email,
          role: users.role,
          position: users.position,
          avatarUrl: users.avatarUrl,
          timezone: users.timezone,
          teamMemberId: users.teamMemberId,
          isActive: users.isActive,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)

      if (!user || !user.isActive) {
        return done(null, false)
      }

      let avatarUrl = user.avatarUrl
      let clientId: number | null = null

      if (user.role === 'team_member' && user.teamMemberId) {
        const [teamMember] = await db
          .select({
            avatarUrl: teamMembers.avatarUrl,
            name: teamMembers.name,
            role: teamMembers.role,
          })
          .from(teamMembers)
          .where(eq(teamMembers.id, user.teamMemberId))
          .limit(1)

        if (teamMember) {
          avatarUrl = teamMember.avatarUrl || user.avatarUrl
        }
      } else if (user.role === 'client') {
        const [clientUser] = await db
          .select({
            clientId: schema.clientUsers.clientId,
          })
          .from(schema.clientUsers)
          .where(and(
            eq(schema.clientUsers.userId, user.id),
            eq(schema.clientUsers.isActive, true)
          ))
          .limit(1)

        if (clientUser) {
          clientId = clientUser.clientId
        }
      }

      const userWithDetails: UserWithoutPassword = {
        ...user,
        avatarUrl,
        clientId
      }

      if (typeof data === 'object' && data.originalUserId) {
        const userWithImpersonation = {
          ...userWithDetails,
          originalUserId: data.originalUserId,
          originalUsername: data.originalUsername,
          originalEmail: data.originalEmail
        }
        done(null, userWithImpersonation as UserWithImpersonation)
      } else {
        done(null, userWithDetails)
      }
    } catch (error) {
      done(error)
    }
  })
}