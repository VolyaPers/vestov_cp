import { Router } from 'express';
import { eq, desc, and, sql } from 'drizzle-orm';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from '../db/index.js';
import { clients, teamMembers, leaveRequests, leaveBalances, leaveTypes, employmentCycles, leaveRequestEvents, timeEntries, feedback } from '../db/schema.js';
import { requireAdmin } from '../middleware/auth.js';
import { calculateDays } from '../utils/dateUtils.js';
const router = Router();
// Apply admin middleware to all routes
router.use(requireAdmin);
// Configure multer for logo uploads
const logoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(process.cwd(), 'uploads', 'logos');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const logoUpload = multer({
    storage: logoStorage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit for logos
    },
    fileFilter: (req, file, cb) => {
        // Allow common image types
        const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'image/svg+xml'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Invalid file type. Only image files (JPEG, PNG, GIF, WebP, SVG) are allowed.'));
        }
    }
});
// Dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const [clientCount] = await db.select({ count: sql `count(*)` }).from(clients);
        const [teamMemberCount] = await db.select({ count: sql `count(*)` }).from(teamMembers);
        const [pendingLeaveRequests] = await db
            .select({ count: sql `count(*)` })
            .from(leaveRequests)
            .where(eq(leaveRequests.status, 'pending'));
        const activeTeamMembers = await db
            .select({ count: sql `count(*)` })
            .from(teamMembers)
            .where(eq(teamMembers.status, 'active'));
        res.json({
            stats: {
                totalClients: clientCount.count,
                totalTeamMembers: teamMemberCount.count,
                activeTeamMembers: activeTeamMembers[0].count,
                pendingLeaveRequests: pendingLeaveRequests.count,
            }
        });
    }
    catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ error: 'Failed to load dashboard data' });
    }
});
// Clients CRUD
router.get('/clients', async (req, res) => {
    try {
        const allClients = await db.select().from(clients).orderBy(desc(clients.createdAt));
        res.json(allClients);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch clients' });
    }
});
router.get('/clients/:id', async (req, res) => {
    console.log('[ROUTE HANDLER] GET /clients/:id START');
    console.log('[ROUTE HANDLER] req.params:', req.params);
    console.log('[ROUTE HANDLER] req.params.id:', req.params.id);
    try {
        const clientId = parseInt(req.params.id);
        console.log('[ROUTE HANDLER] Parsed clientId:', clientId, 'Type:', typeof clientId);
        if (isNaN(clientId)) {
            console.log('[ROUTE HANDLER] Invalid ID - not a number');
            return res.status(400).json({ error: 'Invalid client ID' });
        }
        console.log('[ROUTE HANDLER] About to query database...');
        const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
        console.log('[ROUTE HANDLER] Database query completed. Result:', client);
        if (!client) {
            console.log('[ROUTE HANDLER] Client not found in database');
            return res.status(404).json({ error: 'Client not found' });
        }
        console.log('[ROUTE HANDLER] Success! Returning client:', client.name);
        res.json(client);
    }
    catch (error) {
        console.error('[ROUTE HANDLER] CAUGHT ERROR:', error);
        console.error('[ROUTE HANDLER] Error stack:', error instanceof Error ? error.stack : 'No stack');
        res.status(500).json({ error: 'Failed to fetch client' });
    }
});
router.post('/clients', async (req, res) => {
    try {
        const [client] = await db.insert(clients).values(req.body).returning();
        res.json(client);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create client' });
    }
});
router.put('/clients/:id', async (req, res) => {
    try {
        const [client] = await db
            .update(clients)
            .set({ ...req.body, updatedAt: new Date() })
            .where(eq(clients.id, parseInt(req.params.id)))
            .returning();
        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }
        res.json(client);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update client' });
    }
});
// Upload client logo
router.post('/clients/:id/logo', logoUpload.single('logo'), async (req, res) => {
    try {
        const clientId = parseInt(req.params.id);
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        // Verify client exists
        const [client] = await db
            .select()
            .from(clients)
            .where(eq(clients.id, clientId))
            .limit(1);
        if (!client) {
            // Clean up uploaded file
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ error: 'Client not found' });
        }
        // Delete old logo if it exists
        if (client.logoUrl) {
            const oldLogoPath = path.join(process.cwd(), 'uploads', 'logos', path.basename(client.logoUrl));
            try {
                if (fs.existsSync(oldLogoPath)) {
                    fs.unlinkSync(oldLogoPath);
                }
            }
            catch (error) {
                console.error('Error deleting old logo:', error);
            }
        }
        // Update client with new logo URL
        const logoUrl = `/uploads/logos/${req.file.filename}`;
        const [updatedClient] = await db
            .update(clients)
            .set({
            logoUrl,
            updatedAt: new Date()
        })
            .where(eq(clients.id, clientId))
            .returning();
        res.json({
            ...updatedClient,
            message: 'Logo uploaded successfully'
        });
    }
    catch (error) {
        console.error('Error uploading logo:', error);
        // Clean up uploaded file on error
        if (req.file) {
            try {
                fs.unlinkSync(req.file.path);
            }
            catch (cleanupError) {
                console.error('Error cleaning up uploaded file:', cleanupError);
            }
        }
        res.status(500).json({ error: 'Failed to upload logo' });
    }
});
// Team Members CRUD
router.get('/team-members', async (req, res) => {
    try {
        const { billable, email } = req.query;
        let query = db
            .select({
            id: teamMembers.id,
            name: teamMembers.name,
            role: teamMembers.role,
            email: teamMembers.email,
            phone: teamMembers.phone,
            skills: teamMembers.skills,
            bio: teamMembers.bio,
            hourlyRate: teamMembers.hourlyRate,
            monthlyRate: teamMembers.monthlyRate,
            isBillable: teamMembers.isBillable,
            status: teamMembers.status,
            startDate: teamMembers.startDate,
            location: teamMembers.location,
            avatarUrl: teamMembers.avatarUrl,
            clientId: teamMembers.clientId,
            clientName: clients.name,
        })
            .from(teamMembers)
            .leftJoin(clients, eq(teamMembers.clientId, clients.id));
        let conditions = [];
        // Add billable filter if provided
        if (billable === 'true') {
            conditions.push(eq(teamMembers.isBillable, true));
        }
        else if (billable === 'false') {
            conditions.push(eq(teamMembers.isBillable, false));
        }
        // Add email filter if provided
        if (email) {
            conditions.push(eq(teamMembers.email, email));
        }
        if (conditions.length > 0) {
            query = query.where(and(...conditions));
        }
        const members = await query.orderBy(desc(teamMembers.createdAt));
        res.json(members);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch team members' });
    }
});
router.get('/team-members/:id', async (req, res) => {
    try {
        const [member] = await db
            .select({
            id: teamMembers.id,
            name: teamMembers.name,
            role: teamMembers.role,
            email: teamMembers.email,
            phone: teamMembers.phone,
            skills: teamMembers.skills,
            bio: teamMembers.bio,
            hourlyRate: teamMembers.hourlyRate,
            monthlyRate: teamMembers.monthlyRate,
            isBillable: teamMembers.isBillable,
            status: teamMembers.status,
            startDate: teamMembers.startDate,
            location: teamMembers.location,
            avatarUrl: teamMembers.avatarUrl,
            clientId: teamMembers.clientId,
            clientName: clients.name,
        })
            .from(teamMembers)
            .leftJoin(clients, eq(teamMembers.clientId, clients.id))
            .where(eq(teamMembers.id, parseInt(req.params.id)));
        if (!member) {
            return res.status(404).json({ error: 'Team member not found' });
        }
        res.json(member);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch team member' });
    }
});
router.post('/team-members', async (req, res) => {
    try {
        const [member] = await db.insert(teamMembers).values(req.body).returning();
        res.json(member);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create team member' });
    }
});
router.put('/team-members/:id', async (req, res) => {
    try {
        const [member] = await db
            .update(teamMembers)
            .set({ ...req.body, updatedAt: new Date() })
            .where(eq(teamMembers.id, parseInt(req.params.id)))
            .returning();
        if (!member) {
            return res.status(404).json({ error: 'Team member not found' });
        }
        res.json(member);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update team member' });
    }
});
router.delete('/team-members/:id', async (req, res) => {
    try {
        console.log(`Attempting to delete team member with ID: ${req.params.id}`);
        const memberId = parseInt(req.params.id);
        // First, check if the team member exists
        const existingMember = await db
            .select()
            .from(teamMembers)
            .where(eq(teamMembers.id, memberId))
            .limit(1);
        if (existingMember.length === 0) {
            console.log(`Team member with ID ${req.params.id} not found`);
            return res.status(404).json({ error: 'Team member not found' });
        }
        // Delete all related records to avoid foreign key constraint violations
        console.log(`Deleting related records for team member ${memberId}`);
        // 1. Delete leave request events first (they reference leave requests)
        const memberLeaveRequests = await db
            .select({ id: leaveRequests.id })
            .from(leaveRequests)
            .where(eq(leaveRequests.employeeId, memberId));
        for (const request of memberLeaveRequests) {
            await db.delete(leaveRequestEvents).where(eq(leaveRequestEvents.leaveRequestId, request.id));
        }
        // 2. Delete leave requests
        await db.delete(leaveRequests).where(eq(leaveRequests.employeeId, memberId));
        // 3. Delete leave balances
        await db.delete(leaveBalances).where(eq(leaveBalances.employeeId, memberId));
        // 4. Delete employment cycles
        await db.delete(employmentCycles).where(eq(employmentCycles.employeeId, memberId));
        // 5. Delete feedback records
        await db.delete(feedback).where(eq(feedback.teamMemberId, memberId));
        // 6. Update time entries to remove team member reference (set to null instead of deleting)
        await db.update(timeEntries)
            .set({ teamMemberId: null })
            .where(eq(timeEntries.teamMemberId, memberId));
        // Now delete the team member
        const [member] = await db
            .delete(teamMembers)
            .where(eq(teamMembers.id, memberId))
            .returning();
        console.log(`Successfully deleted team member: ${member.id}`);
        res.json({ message: 'Team member deleted successfully', id: member.id });
    }
    catch (error) {
        console.error('Error deleting team member:', error);
        res.status(500).json({ error: 'Failed to delete team member' });
    }
});
// Leave Management
router.get('/leave-requests', async (req, res) => {
    try {
        const requests = await db
            .select({
            id: leaveRequests.id,
            employeeId: leaveRequests.employeeId,
            employeeName: teamMembers.name,
            employeeRole: teamMembers.role,
            employeeAvatar: teamMembers.avatarUrl,
            leaveTypeId: leaveRequests.leaveTypeId,
            leaveTypeName: leaveTypes.name,
            status: leaveRequests.status,
            startDate: leaveRequests.startDate,
            endDate: leaveRequests.endDate,
            halfDayStart: leaveRequests.halfDayStart,
            halfDayEnd: leaveRequests.halfDayEnd,
            daysCount: leaveRequests.daysCount,
            reason: leaveRequests.reason,
            requestedBy: leaveRequests.requestedBy,
            decisionBy: leaveRequests.decisionBy,
            decisionAt: leaveRequests.decisionAt,
            decisionReason: leaveRequests.decisionReason,
            createdAt: leaveRequests.createdAt,
        })
            .from(leaveRequests)
            .leftJoin(teamMembers, eq(leaveRequests.employeeId, teamMembers.id))
            .leftJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
            .orderBy(desc(leaveRequests.createdAt));
        res.json(requests);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch leave requests' });
    }
});
router.post('/leave-requests', async (req, res) => {
    try {
        const { employeeId, leaveTypeId, startDate, endDate, halfDayStart, halfDayEnd, reason } = req.body;
        // Calculate days count
        const daysCount = calculateDays(startDate, endDate, halfDayStart, halfDayEnd);
        const [request] = await db.insert(leaveRequests).values({
            employeeId,
            leaveTypeId,
            startDate,
            endDate,
            halfDayStart: halfDayStart || false,
            halfDayEnd: halfDayEnd || false,
            daysCount,
            reason,
            requestedBy: req.user.id,
        }).returning();
        // Create audit trail event
        await db.insert(leaveRequestEvents).values({
            leaveRequestId: request.id,
            status: 'pending',
            actorId: req.user.id,
            note: 'Leave request created',
        });
        res.json(request);
    }
    catch (error) {
        console.error('Create leave request error:', error);
        res.status(500).json({ error: 'Failed to create leave request' });
    }
});
router.patch('/leave-requests/:id', async (req, res) => {
    try {
        const { startDate, endDate, halfDayStart, halfDayEnd, reason } = req.body;
        // Recalculate days if dates changed
        let updateData = req.body;
        if (startDate && endDate) {
            updateData.daysCount = calculateDays(startDate, endDate, halfDayStart, halfDayEnd);
        }
        const [request] = await db
            .update(leaveRequests)
            .set({ ...updateData, updatedAt: new Date() })
            .where(eq(leaveRequests.id, parseInt(req.params.id)))
            .returning();
        if (!request) {
            return res.status(404).json({ error: 'Leave request not found' });
        }
        res.json(request);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update leave request' });
    }
});
router.patch('/leave-requests/:id/approve', async (req, res) => {
    try {
        const { reason } = req.body;
        const [request] = await db
            .update(leaveRequests)
            .set({
            status: 'approved',
            decisionBy: req.user.id,
            decisionAt: new Date(),
            decisionReason: reason,
            updatedAt: new Date(),
        })
            .where(eq(leaveRequests.id, parseInt(req.params.id)))
            .returning();
        if (!request) {
            return res.status(404).json({ error: 'Leave request not found' });
        }
        // Create audit trail event
        await db.insert(leaveRequestEvents).values({
            leaveRequestId: request.id,
            status: 'approved',
            actorId: req.user.id,
            note: reason || 'Leave request approved',
        });
        res.json(request);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to approve leave request' });
    }
});
router.patch('/leave-requests/:id/deny', async (req, res) => {
    try {
        const { reason } = req.body;
        const [request] = await db
            .update(leaveRequests)
            .set({
            status: 'denied',
            decisionBy: req.user.id,
            decisionAt: new Date(),
            decisionReason: reason,
            updatedAt: new Date(),
        })
            .where(eq(leaveRequests.id, parseInt(req.params.id)))
            .returning();
        if (!request) {
            return res.status(404).json({ error: 'Leave request not found' });
        }
        // Create audit trail event
        await db.insert(leaveRequestEvents).values({
            leaveRequestId: request.id,
            status: 'denied',
            actorId: req.user.id,
            note: reason || 'Leave request denied',
        });
        res.json(request);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to deny leave request' });
    }
});
router.patch('/leave-requests/:id/cancel', async (req, res) => {
    try {
        const { reason } = req.body;
        const [request] = await db
            .update(leaveRequests)
            .set({
            status: 'canceled',
            updatedAt: new Date(),
        })
            .where(eq(leaveRequests.id, parseInt(req.params.id)))
            .returning();
        if (!request) {
            return res.status(404).json({ error: 'Leave request not found' });
        }
        // Create audit trail event
        await db.insert(leaveRequestEvents).values({
            leaveRequestId: request.id,
            status: 'canceled',
            actorId: req.user.id,
            note: reason || 'Leave request canceled',
        });
        res.json(request);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to cancel leave request' });
    }
});
// Leave Balances
router.get('/leave-balances', async (req, res) => {
    try {
        const balances = await db
            .select({
            id: leaveBalances.id,
            employeeId: leaveBalances.employeeId,
            employeeName: teamMembers.name,
            leaveTypeId: leaveBalances.leaveTypeId,
            leaveTypeName: leaveTypes.name,
            totalDays: leaveBalances.totalDays,
            adjustmentDays: leaveBalances.adjustmentDays,
        })
            .from(leaveBalances)
            .leftJoin(teamMembers, eq(leaveBalances.employeeId, teamMembers.id))
            .leftJoin(leaveTypes, eq(leaveBalances.leaveTypeId, leaveTypes.id));
        res.json(balances);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch leave balances' });
    }
});
// Leave Types
router.get('/leave-types', async (req, res) => {
    try {
        const types = await db.select().from(leaveTypes);
        res.json(types);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch leave types' });
    }
});
// Delete Client
router.delete('/clients/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const clientId = parseInt(id);
        // Check if client exists
        const [client] = await db
            .select()
            .from(clients)
            .where(eq(clients.id, clientId));
        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }
        // Delete client (related data will be cascade deleted by database constraints)
        await db
            .delete(clients)
            .where(eq(clients.id, clientId));
        res.json({ message: 'Client deleted successfully', clientId });
    }
    catch (error) {
        console.error('Error deleting client:', error);
        res.status(500).json({ error: 'Failed to delete client' });
    }
});
export { router as adminRouter };
