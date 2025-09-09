import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcryptjs';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { users, clients } from '../db/schema.js';
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
                clientId: users.clientId,
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
            // Get client info if user is associated with a client
            let clientInfo = null;
            if (user.clientId) {
                const [client] = await db
                    .select({
                    id: clients.id,
                    name: clients.name,
                    industry: clients.industry,
                })
                    .from(clients)
                    .where(eq(clients.id, user.clientId))
                    .limit(1);
                clientInfo = client;
            }
            // Remove password from user object
            const { password: _, ...userWithoutPassword } = user;
            return done(null, { ...userWithoutPassword, client: clientInfo });
        }
        catch (error) {
            return done(error);
        }
    }));
    // Serialize user for session
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });
    // Deserialize user from session
    passport.deserializeUser(async (id, done) => {
        try {
            const [user] = await db
                .select({
                id: users.id,
                username: users.username,
                fullName: users.fullName,
                email: users.email,
                role: users.role,
                position: users.position,
                avatarUrl: users.avatarUrl,
                clientId: users.clientId,
            })
                .from(users)
                .where(eq(users.id, id))
                .limit(1);
            if (!user) {
                return done(null, false);
            }
            // Get client info if user is associated with a client
            let clientInfo = null;
            if (user.clientId) {
                const [client] = await db
                    .select({
                    id: clients.id,
                    name: clients.name,
                    industry: clients.industry,
                })
                    .from(clients)
                    .where(eq(clients.id, user.clientId))
                    .limit(1);
                clientInfo = client;
            }
            done(null, { ...user, client: clientInfo });
        }
        catch (error) {
            done(error);
        }
    });
}
