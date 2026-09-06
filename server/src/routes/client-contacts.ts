import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import { uploadsDirectory } from '../utils/uploads.js'
import fs from 'fs'
import { db } from '../db/index.js'
import { clientContacts, clients } from '../db/schema.js'
import { canAccessClient } from '../services/access.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { eq, and, desc } from 'drizzle-orm'

const router = Router()
for (const param of ['clientId', 'contactId']) router.param(param, (_req, res, next, value) => {
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) return res.status(400).json({ error: `Invalid ${param}` })
  next()
})

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const uploadPath = path.join(uploadsDirectory, 'contacts')
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true })
      }
      cb(null, uploadPath)
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
      cb(null, `contact-${uniqueSuffix}${path.extname(file.originalname)}`)
    },
  }),
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image files are allowed'))
      return
    }
    cb(null, true)
  },
  limits: { fileSize: 5 * 1024 * 1024 },
})

// Get all contacts for a client
router.get('/client/:clientId', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user
    if (!['admin', 'client'].includes(user.role) || !await canAccessClient(user, Number(req.params.clientId))) {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { clientId } = req.params

    const contacts = await db
      .select()
      .from(clientContacts)
      .where(and(
        eq(clientContacts.clientId, parseInt(clientId)),
        eq(clientContacts.isActive, true)
      ))
      .orderBy(desc(clientContacts.isPrimary), desc(clientContacts.createdAt))

    res.json(user.role === 'admin' ? contacts : contacts.map(({ id, clientId, fullName, position, email, phone, avatarUrl, isPrimary }) => ({ id, clientId, fullName, position, email, phone, avatarUrl, isPrimary })))
  } catch (error) {
    console.error('Error fetching client contacts:', error)
    res.status(500).json({ error: 'Failed to fetch contacts' })
  }
})

// Create a new contact for a client
router.post('/client/:clientId', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { clientId } = req.params
    const { fullName, position, email, phone, avatarUrl, notes, isPrimary } = req.body

    if (!fullName) {
      return res.status(400).json({ error: 'Full name is required' })
    }

    // Verify client exists
    const client = await db
      .select()
      .from(clients)
      .where(eq(clients.id, parseInt(clientId)))
      .limit(1)

    if (client.length === 0) {
      return res.status(404).json({ error: 'Client not found' })
    }

    // If setting as primary, unset other primary contacts
    if (isPrimary) {
      await db
        .update(clientContacts)
        .set({ isPrimary: false })
        .where(eq(clientContacts.clientId, parseInt(clientId)))
    }

    // Create new contact
    const [newContact] = await db
      .insert(clientContacts)
      .values({
        clientId: parseInt(clientId),
        fullName,
        position: position || null,
        email: email || null,
        phone: phone || null,
        avatarUrl: avatarUrl || null,
        notes: notes || null,
        isPrimary: isPrimary || false,
      })
      .returning()

    res.json(newContact)
  } catch (error) {
    console.error('Error creating contact:', error)
    res.status(500).json({ error: 'Failed to create contact' })
  }
})

// Update a contact
router.put('/:contactId', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { contactId } = req.params
    const { fullName, position, email, phone, avatarUrl, notes, isPrimary } = req.body

    if (!fullName) {
      return res.status(400).json({ error: 'Full name is required' })
    }

    // Get current contact to find clientId
    const currentContact = await db
      .select()
      .from(clientContacts)
      .where(eq(clientContacts.id, parseInt(contactId)))
      .limit(1)

    if (currentContact.length === 0) {
      return res.status(404).json({ error: 'Contact not found' })
    }

    // If setting as primary, unset other primary contacts for this client
    if (isPrimary && !currentContact[0].isPrimary) {
      await db
        .update(clientContacts)
        .set({ isPrimary: false })
        .where(eq(clientContacts.clientId, currentContact[0].clientId))
    }

    // Update contact
    const updateData: Record<string, unknown> = {
      fullName,
      position: position || null,
      email: email || null,
      phone: phone || null,
      notes: notes || null,
      isPrimary: isPrimary || false,
      updatedAt: new Date(),
    }

    if (avatarUrl !== undefined) {
      updateData.avatarUrl = avatarUrl || null
    }

    const [updatedContact] = await db
      .update(clientContacts)
      .set(updateData)
      .where(eq(clientContacts.id, parseInt(contactId)))
      .returning()

    if (!updatedContact) {
      return res.status(404).json({ error: 'Contact not found' })
    }

    res.json(updatedContact)
  } catch (error) {
    console.error('Error updating contact:', error)
    res.status(500).json({ error: 'Failed to update contact' })
  }
})

// Delete a contact (soft delete)
router.delete('/:contactId', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { contactId } = req.params

    const [deletedContact] = await db
      .update(clientContacts)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(clientContacts.id, parseInt(contactId)))
      .returning()

    if (!deletedContact) {
      return res.status(404).json({ error: 'Contact not found' })
    }

    res.json({ message: 'Contact deleted successfully' })
  } catch (error) {
    console.error('Error deleting contact:', error)
    res.status(500).json({ error: 'Failed to delete contact' })
  }
})

// Upload or replace a contact avatar
router.post('/:contactId/avatar', requireAuth, requireAdmin, avatarUpload.single('avatar'), async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { contactId } = req.params

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const currentContact = await db
      .select()
      .from(clientContacts)
      .where(eq(clientContacts.id, parseInt(contactId)))
      .limit(1)

    if (currentContact.length === 0) {
      fs.unlinkSync(req.file.path)
      return res.status(404).json({ error: 'Contact not found' })
    }

    const avatarUrl = `/api/uploads/contacts/${req.file.filename}`
    const [updatedContact] = await db
      .update(clientContacts)
      .set({
        avatarUrl,
        updatedAt: new Date(),
      })
      .where(eq(clientContacts.id, parseInt(contactId)))
      .returning()

    if (!updatedContact) {
      fs.unlinkSync(req.file.path)
      return res.status(404).json({ error: 'Contact not found' })
    }
    if (currentContact[0].avatarUrl?.startsWith('/api/uploads/contacts/')) {
      const oldAvatarPath = path.join(uploadsDirectory, 'contacts', path.basename(currentContact[0].avatarUrl))
      try { await fs.promises.unlink(oldAvatarPath) }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') console.error('[CONTACTS] Previous avatar cleanup failed') }
    }

    res.json({
      ...updatedContact,
      message: 'Contact avatar uploaded successfully',
    })
  } catch (error) {
    console.error('Error uploading contact avatar:', error)

    if (req.file) {
      try {
        fs.unlinkSync(req.file.path)
      } catch (cleanupError) {
        console.error('Error cleaning up contact avatar:', cleanupError)
      }
    }

    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to upload contact avatar' })
  }
})

// Get a specific contact
router.get('/:contactId', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { contactId } = req.params

    const contact = await db
      .select()
      .from(clientContacts)
      .where(and(
        eq(clientContacts.id, parseInt(contactId)),
        eq(clientContacts.isActive, true)
      ))
      .limit(1)

    if (contact.length === 0) {
      return res.status(404).json({ error: 'Contact not found' })
    }

    res.json(contact[0])
  } catch (error) {
    console.error('Error fetching contact:', error)
    res.status(500).json({ error: 'Failed to fetch contact' })
  }
})

export { router as clientContactsRouter }
