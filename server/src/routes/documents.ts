import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { db } from '../db/index.js'
import { documents, clients, users } from '../db/schema.js'
import { requireAuth } from '../middleware/auth.js'
import { eq, and, desc } from 'drizzle-orm'

const router = Router()

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), 'uploads', 'documents')
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true })
    }
    cb(null, uploadPath)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
})

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow common document types
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain'
    ]

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only PDF, Word, Excel, images and text files are allowed.'))
    }
  }
})

// Get all documents for a client
router.get('/client/:clientId', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { clientId } = req.params

    const clientDocuments = await db
      .select({
        document: documents,
        uploadedBy: {
          id: users.id,
          fullName: users.fullName,
          email: users.email,
        }
      })
      .from(documents)
      .leftJoin(users, eq(documents.userId, users.id))
      .where(eq(documents.clientId, parseInt(clientId)))
      .orderBy(desc(documents.createdAt))

    res.json(clientDocuments)
  } catch (error) {
    console.error('Error fetching client documents:', error)
    res.status(500).json({ error: 'Failed to fetch documents' })
  }
})

// Upload a document for a client
router.post('/upload', requireAuth, upload.single('document'), async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const { clientId, type = 'general', description } = req.body

    if (!clientId) {
      return res.status(400).json({ error: 'Client ID is required' })
    }

    // Verify client exists
    const client = await db
      .select()
      .from(clients)
      .where(eq(clients.id, parseInt(clientId)))
      .limit(1)

    if (client.length === 0) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path)
      return res.status(404).json({ error: 'Client not found' })
    }

    // Create document record
    const [newDocument] = await db
      .insert(documents)
      .values({
        name: req.file.originalname,
        type: type,
        fileSize: req.file.size,
        url: `/uploads/documents/${req.file.filename}`,
        userId: user.id,
        clientId: parseInt(clientId),
      })
      .returning()

    res.json({
      ...newDocument,
      uploadedBy: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
      }
    })
  } catch (error) {
    console.error('Error uploading document:', error)

    // Clean up uploaded file on error
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path)
      } catch (cleanupError) {
        console.error('Error cleaning up uploaded file:', cleanupError)
      }
    }

    res.status(500).json({ error: 'Failed to upload document' })
  }
})

// Preview a document (view inline)
router.get('/preview/:documentId', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { documentId } = req.params

    const document = await db
      .select()
      .from(documents)
      .where(eq(documents.id, parseInt(documentId)))
      .limit(1)

    if (document.length === 0) {
      return res.status(404).json({ error: 'Document not found' })
    }

    const filePath = path.join(process.cwd(), document[0].url)

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' })
    }

    // Set appropriate content type based on file extension
    const ext = path.extname(document[0].name).toLowerCase()
    let contentType = 'application/octet-stream'

    switch (ext) {
      case '.pdf':
        contentType = 'application/pdf'
        break
      case '.doc':
        contentType = 'application/msword'
        break
      case '.docx':
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        break
      case '.xls':
        contentType = 'application/vnd.ms-excel'
        break
      case '.xlsx':
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        break
      case '.txt':
        contentType = 'text/plain'
        break
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg'
        break
      case '.png':
        contentType = 'image/png'
        break
      case '.gif':
        contentType = 'image/gif'
        break
    }

    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', 'inline; filename="' + document[0].name + '"')
    res.sendFile(path.resolve(filePath))
  } catch (error) {
    console.error('Error previewing document:', error)
    res.status(500).json({ error: 'Failed to preview document' })
  }
})

// Download a document
router.get('/download/:documentId', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { documentId } = req.params

    const document = await db
      .select()
      .from(documents)
      .where(eq(documents.id, parseInt(documentId)))
      .limit(1)

    if (document.length === 0) {
      return res.status(404).json({ error: 'Document not found' })
    }

    const filePath = path.join(process.cwd(), document[0].url)

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' })
    }

    res.download(filePath, document[0].name)
  } catch (error) {
    console.error('Error downloading document:', error)
    res.status(500).json({ error: 'Failed to download document' })
  }
})

// Delete a document
router.delete('/:documentId', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { documentId } = req.params

    const document = await db
      .select()
      .from(documents)
      .where(eq(documents.id, parseInt(documentId)))
      .limit(1)

    if (document.length === 0) {
      return res.status(404).json({ error: 'Document not found' })
    }

    // Delete file from disk
    const filePath = path.join(process.cwd(), document[0].url)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    // Delete from database
    await db
      .delete(documents)
      .where(eq(documents.id, parseInt(documentId)))

    res.json({ message: 'Document deleted successfully' })
  } catch (error) {
    console.error('Error deleting document:', error)
    res.status(500).json({ error: 'Failed to delete document' })
  }
})

// Update document metadata
router.put('/:documentId', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { documentId } = req.params
    const { name, type } = req.body

    if (!name && !type) {
      return res.status(400).json({ error: 'Name or type is required' })
    }

    const updateData: any = {}
    if (name) updateData.name = name
    if (type) updateData.type = type

    const [updatedDocument] = await db
      .update(documents)
      .set(updateData)
      .where(eq(documents.id, parseInt(documentId)))
      .returning()

    if (!updatedDocument) {
      return res.status(404).json({ error: 'Document not found' })
    }

    res.json(updatedDocument)
  } catch (error) {
    console.error('Error updating document:', error)
    res.status(500).json({ error: 'Failed to update document' })
  }
})

// Get document types/categories
router.get('/types', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    // Common document categories for client documents
    const documentTypes = [
      { value: 'contract', label: 'Contract' },
      { value: 'invoice', label: 'Invoice' },
      { value: 'proposal', label: 'Proposal' },
      { value: 'report', label: 'Report' },
      { value: 'specification', label: 'Specification' },
      { value: 'presentation', label: 'Presentation' },
      { value: 'legal', label: 'Legal Document' },
      { value: 'financial', label: 'Financial Document' },
      { value: 'technical', label: 'Technical Documentation' },
      { value: 'general', label: 'General' },
    ]

    res.json(documentTypes)
  } catch (error) {
    console.error('Error fetching document types:', error)
    res.status(500).json({ error: 'Failed to fetch document types' })
  }
})

export { router as documentsRouter }