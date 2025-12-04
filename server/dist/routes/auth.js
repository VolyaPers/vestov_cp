import { Router } from 'express';
import passport from 'passport';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { users, teamMembers } from '../db/schema.js';
import { eq } from 'drizzle-orm';
const router = Router();
// Rate limiting for login attempts (disabled in development)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 5 : 1000, // Much higher limit for dev
    message: 'Too many login attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});
// Login route
router.post('/login', loginLimiter, (req, res, next) => {
    console.log('Login attempt:', req.body.username);
    passport.authenticate('local', (err, user, info) => {
        if (err) {
            console.error('Login error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        if (!user) {
            console.log('Login failed:', info?.message);
            return res.status(401).json({ error: info?.message || 'Invalid credentials' });
        }
        req.logIn(user, (err) => {
            if (err) {
                console.error('Session login error:', err);
                return res.status(500).json({ error: 'Login failed' });
            }
            console.log('Login successful for user:', user.username);
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
            });
        });
    })(req, res, next);
});
// Logout route
router.post('/logout', requireAuth, (req, res) => {
    req.logout((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ message: 'Logged out successfully' });
    });
});
// Get current user
router.get('/user', (req, res) => {
    if (req.isAuthenticated() && req.user) {
        const user = req.user;
        console.log('[GET /user] Session user object:', {
            id: user.id,
            email: user.email,
            role: user.role,
            originalUserId: user.originalUserId,
            originalEmail: user.originalEmail,
            hasOriginalUserId: !!user.originalUserId
        });
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
        });
    }
    else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});
// Impersonate user (super admin only - v@vestov)
router.post('/impersonate/:userId', requireAuth, async (req, res) => {
    try {
        const currentUser = req.user;
        // Only allow v@vestov to impersonate
        if (currentUser.email !== 'v@vestov.com') {
            return res.status(403).json({ error: 'Only super admin can impersonate users' });
        }
        // Don't allow impersonating while already impersonating
        if (currentUser.originalUserId) {
            return res.status(400).json({ error: 'Already impersonating a user. Stop impersonation first.' });
        }
        const targetUserId = parseInt(req.params.userId);
        // Get target user
        const [targetUser] = await db
            .select()
            .from(users)
            .where(eq(users.id, targetUserId));
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Don't allow impersonating self
        if (targetUser.id === currentUser.id) {
            return res.status(400).json({ error: 'Cannot impersonate yourself' });
        }
        // If target is a team member, get avatar from team_members table via foreign key
        let avatarUrl = targetUser.avatarUrl;
        if (targetUser.role === 'team_member' && targetUser.teamMemberId) {
            const [teamMember] = await db
                .select({ avatarUrl: teamMembers.avatarUrl })
                .from(teamMembers)
                .where(eq(teamMembers.id, targetUser.teamMemberId))
                .limit(1);
            if (teamMember && teamMember.avatarUrl) {
                avatarUrl = teamMember.avatarUrl;
            }
        }
        // Store original user info in session and switch to target user
        const impersonatedUser = {
            ...targetUser,
            avatarUrl, // Use the avatar from team_members if available
            originalUserId: currentUser.id,
            originalUsername: currentUser.username,
            originalEmail: currentUser.email
        };
        req.logIn(impersonatedUser, (err) => {
            if (err) {
                return res.status(500).json({ error: 'Impersonation failed' });
            }
            console.log(`Super admin ${currentUser.email} impersonating ${targetUser.email}`);
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
            });
        });
    }
    catch (error) {
        console.error('Error impersonating user:', error);
        res.status(500).json({ error: 'Failed to impersonate user' });
    }
});
// Stop impersonation and return to original user
router.post('/stop-impersonation', requireAuth, async (req, res) => {
    try {
        const currentUser = req.user;
        if (!currentUser.originalUserId) {
            return res.status(400).json({ error: 'Not currently impersonating' });
        }
        // Get original user
        const [originalUser] = await db
            .select()
            .from(users)
            .where(eq(users.id, currentUser.originalUserId));
        if (!originalUser) {
            return res.status(404).json({ error: 'Original user not found' });
        }
        req.logIn(originalUser, (err) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to stop impersonation' });
            }
            console.log(`Stopped impersonating, returned to ${originalUser.email}`);
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
            });
        });
    }
    catch (error) {
        console.error('Error stopping impersonation:', error);
        res.status(500).json({ error: 'Failed to stop impersonation' });
    }
});
export { router as authRouter };
