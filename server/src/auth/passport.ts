import passport from 'passport'
import { Strategy as LocalStrategy } from 'passport-local'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import bcrypt from 'bcryptjs'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql } from 'drizzle-orm'
import { eq } from 'drizzle-orm'
import { users, teamMembers } from '../db/schema.js'
import * as schema from '../db/schema.js'
import { linkOrCreateUserAccount } from '../services/userService.js'
import type { UserWithPassword, UserWithoutPassword, SessionData, UserWithImpersonation } from '../types/passport.js'

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

            const { user: linkedUser } = await linkOrCreateUserAccount({
              email,
              fullName,
              googleId,
              avatarUrl,
            })

            if (!linkedUser.isActive) {
              return done(null, false, { message: 'Your account is inactive. Please contact an administrator as only administrators can reactivate inactive users.' })
            }

            const { password: _, ...userWithoutPassword } = linkedUser
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
      }

      const userWithAvatar: UserWithoutPassword = {
        ...user,
        avatarUrl
      }

      if (typeof data === 'object' && data.originalUserId) {
        const userWithImpersonation = {
          ...userWithAvatar,
          originalUserId: data.originalUserId,
          originalUsername: data.originalUsername,
          originalEmail: data.originalEmail
        }
        done(null, userWithImpersonation as UserWithImpersonation)
      } else {
        done(null, userWithAvatar)
      }
    } catch (error) {
      done(error)
    }
  })
}