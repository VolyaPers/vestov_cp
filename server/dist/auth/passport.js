import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcryptjs';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { users, teamMembers } from '../db/schema.js';
export function setupPassport(pool) {
    const db = drizzle(pool);
    // Local Strategy
    passport.use(new LocalStrategy(async (username, password, done) => {
        try {
            const [user] = await db
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
                .where(eq(users.username, username))
                .limit(1);
            if (!user) {
                return done(null, false, { message: 'Invalid username or password' });
            }
            const isValidPassword = await bcrypt.compare(password, user.password);
            if (!isValidPassword) {
                return done(null, false, { message: 'Invalid username or password' });
            }
            // Check if user is active
            if (!user.isActive) {
                return done(null, false, { message: 'Account is deactivated' });
            }
            // Remove password from user object
            const { password: _, ...userWithoutPassword } = user;
            return done(null, userWithoutPassword);
        }
        catch (error) {
            return done(error);
        }
    }));
    // Serialize user for session
    passport.serializeUser((user, done) => {
        // Store user data including impersonation fields
        const sessionData = {
            id: user.id,
            originalUserId: user.originalUserId,
            originalUsername: user.originalUsername,
            originalEmail: user.originalEmail
        };
        done(null, sessionData);
    });
    // Deserialize user from session
    passport.deserializeUser(async (sessionData, done) => {
        try {
            // If sessionData is just a number (old session format), convert it
            const userId = typeof sessionData === 'number' ? sessionData : sessionData.id;
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
                .limit(1);
            if (!user || !user.isActive) {
                return done(null, false);
            }
            // If user is a team member, get avatar and other data from team_members table via foreign key
            let avatarUrl = user.avatarUrl;
            let teamMemberData = null;
            if (user.role === 'team_member' && user.teamMemberId) {
                const [teamMember] = await db
                    .select({
                    avatarUrl: teamMembers.avatarUrl,
                    name: teamMembers.name,
                    role: teamMembers.role,
                })
                    .from(teamMembers)
                    .where(eq(teamMembers.id, user.teamMemberId))
                    .limit(1);
                if (teamMember) {
                    avatarUrl = teamMember.avatarUrl || user.avatarUrl;
                    teamMemberData = teamMember;
                }
            }
            // Create user object with correct avatar
            const userWithAvatar = {
                ...user,
                avatarUrl
            };
            // Restore impersonation fields if they exist
            if (typeof sessionData === 'object' && sessionData.originalUserId) {
                const userWithImpersonation = {
                    ...userWithAvatar,
                    originalUserId: sessionData.originalUserId,
                    originalUsername: sessionData.originalUsername,
                    originalEmail: sessionData.originalEmail
                };
                done(null, userWithImpersonation);
            }
            else {
                done(null, userWithAvatar);
            }
        }
        catch (error) {
            done(error);
        }
    });
}
