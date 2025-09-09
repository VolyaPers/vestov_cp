import { Router } from 'express';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { invoices, clients } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
const router = Router();
// Apply authentication middleware to all routes
router.use(requireAuth);
// Get all invoices (admin only)
router.get('/', async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }
        const allInvoices = await db
            .select({
            id: invoices.id,
            clientId: invoices.clientId,
            clientName: clients.name,
            invoiceNumber: invoices.invoiceNumber,
            amount: invoices.amount,
            invoiceDate: invoices.invoiceDate,
            periodStart: invoices.periodStart,
            periodEnd: invoices.periodEnd,
            description: invoices.description,
            status: invoices.status,
            dueDate: invoices.dueDate,
            paidAt: invoices.paidAt,
            notes: invoices.notes,
            createdAt: invoices.createdAt,
            updatedAt: invoices.updatedAt,
        })
            .from(invoices)
            .leftJoin(clients, eq(invoices.clientId, clients.id))
            .orderBy(desc(invoices.createdAt));
        res.json(allInvoices);
    }
    catch (error) {
        console.error('Get invoices error:', error);
        res.status(500).json({ error: 'Failed to fetch invoices' });
    }
});
// Get invoices for a specific client
router.get('/client/:clientId', async (req, res) => {
    try {
        const clientId = parseInt(req.params.clientId);
        // Check if user has access to this client's data
        if (req.user.role !== 'admin' && req.user.clientId !== clientId) {
            return res.status(403).json({ error: 'Access denied' });
        }
        const clientInvoices = await db
            .select({
            id: invoices.id,
            clientId: invoices.clientId,
            invoiceNumber: invoices.invoiceNumber,
            amount: invoices.amount,
            invoiceDate: invoices.invoiceDate,
            periodStart: invoices.periodStart,
            periodEnd: invoices.periodEnd,
            description: invoices.description,
            status: invoices.status,
            dueDate: invoices.dueDate,
            paidAt: invoices.paidAt,
            notes: invoices.notes,
            createdAt: invoices.createdAt,
            updatedAt: invoices.updatedAt,
        })
            .from(invoices)
            .where(eq(invoices.clientId, clientId))
            .orderBy(desc(invoices.createdAt));
        res.json(clientInvoices);
    }
    catch (error) {
        console.error('Get client invoices error:', error);
        res.status(500).json({ error: 'Failed to fetch client invoices' });
    }
});
// Get a specific invoice
router.get('/:id', async (req, res) => {
    try {
        const invoiceId = parseInt(req.params.id);
        const [invoice] = await db
            .select({
            id: invoices.id,
            clientId: invoices.clientId,
            clientName: clients.name,
            invoiceNumber: invoices.invoiceNumber,
            amount: invoices.amount,
            invoiceDate: invoices.invoiceDate,
            periodStart: invoices.periodStart,
            periodEnd: invoices.periodEnd,
            description: invoices.description,
            status: invoices.status,
            dueDate: invoices.dueDate,
            paidAt: invoices.paidAt,
            notes: invoices.notes,
            createdBy: invoices.createdBy,
            createdAt: invoices.createdAt,
            updatedAt: invoices.updatedAt,
        })
            .from(invoices)
            .leftJoin(clients, eq(invoices.clientId, clients.id))
            .where(eq(invoices.id, invoiceId));
        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }
        // Check if user has access to this invoice
        if (req.user.role !== 'admin' && req.user.clientId !== invoice.clientId) {
            return res.status(403).json({ error: 'Access denied' });
        }
        res.json(invoice);
    }
    catch (error) {
        console.error('Get invoice error:', error);
        res.status(500).json({ error: 'Failed to fetch invoice' });
    }
});
// Create a new invoice (admin only)
router.post('/', async (req, res) => {
    try {
        // Only admins can create invoices
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }
        const { clientId, amount, invoiceDate, periodStart, periodEnd, description, dueDate, notes } = req.body;
        if (!clientId || !amount) {
            return res.status(400).json({ error: 'Client ID and amount are required' });
        }
        // Default values
        const today = new Date().toISOString().split('T')[0];
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        const lastMonthStart = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1).toISOString().split('T')[0];
        const lastMonthEnd = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0).toISOString().split('T')[0];
        // Generate invoice number
        const invoiceCount = await db.select({ count: invoices.id }).from(invoices);
        const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invoiceCount.length + 1).padStart(4, '0')}`;
        const [newInvoice] = await db.insert(invoices).values({
            clientId: parseInt(clientId),
            invoiceNumber,
            amount: amount.toString(),
            invoiceDate: invoiceDate || today,
            periodStart: periodStart || lastMonthStart,
            periodEnd: periodEnd || lastMonthEnd,
            description: description || null,
            dueDate: dueDate || null,
            notes: notes || null,
            createdBy: req.user.id,
        }).returning();
        res.json(newInvoice);
    }
    catch (error) {
        console.error('Create invoice error:', error);
        res.status(500).json({ error: 'Failed to create invoice' });
    }
});
// Update an invoice (admin only)
router.put('/:id', async (req, res) => {
    try {
        // Only admins can update invoices
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }
        const invoiceId = parseInt(req.params.id);
        const updateData = {};
        // Only update fields that are provided
        const allowedFields = ['amount', 'invoiceDate', 'periodStart', 'periodEnd', 'description', 'status', 'dueDate', 'paidAt', 'notes'];
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                if (field === 'amount') {
                    updateData[field] = req.body[field].toString();
                }
                else if (field === 'paidAt' && req.body[field]) {
                    updateData[field] = new Date(req.body[field]);
                }
                else {
                    updateData[field] = req.body[field];
                }
            }
        }
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        updateData.updatedAt = new Date();
        const [updatedInvoice] = await db
            .update(invoices)
            .set(updateData)
            .where(eq(invoices.id, invoiceId))
            .returning();
        if (!updatedInvoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }
        res.json(updatedInvoice);
    }
    catch (error) {
        console.error('Update invoice error:', error);
        res.status(500).json({ error: 'Failed to update invoice' });
    }
});
// Delete an invoice (admin only)
router.delete('/:id', async (req, res) => {
    try {
        // Only admins can delete invoices
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }
        const invoiceId = parseInt(req.params.id);
        const [deletedInvoice] = await db
            .delete(invoices)
            .where(eq(invoices.id, invoiceId))
            .returning({ id: invoices.id });
        if (!deletedInvoice) {
            return res.status(404).json({ error: 'Invoice not found' });
        }
        res.json({ message: 'Invoice deleted successfully' });
    }
    catch (error) {
        console.error('Delete invoice error:', error);
        res.status(500).json({ error: 'Failed to delete invoice' });
    }
});
export { router as invoiceRouter };
