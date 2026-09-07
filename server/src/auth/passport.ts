import { assertPortalAccount, isFreelancerAccount } from '../services/employmentPolicy.js'
import passport from 'passport'
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

  passport.serializeUser((user, done) => {
    const userData = user as UserWithoutPassword & Partial<UserWithImpersonation>
    const sessionData: SessionData = {
      version: 2,
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
      if (typeof data !== 'object' || data.version !== 2) return done(null, false)
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
          createdAt: users.createdAt,
          lastLoginAt: users.lastLoginAt,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)

      if (!user || !user.isActive || await isFreelancerAccount(user, db)) {
        return done(null, false)
      }

      let avatarUrl = user.avatarUrl
      let clientId: number | null = null

      if (user.role === 'team_member' && user.teamMemberId) {
        const [teamMember] = await db
          .select({
            avatarUrl: teamMembers.avatarUrl,
            name: teamMembers.name,
            position: teamMembers.position,
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
        const [original] = await db.select({role:users.role,isActive:users.isActive}).from(users).where(eq(users.id,data.originalUserId)).limit(1)
        if(!original?.isActive || original.role!=='admin') return done(null,false)
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