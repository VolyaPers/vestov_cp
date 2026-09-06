import { Router } from 'express'
import { clientServiceDto } from '../services/clientWorkspace.js'
import { canAccessClient, canAccessService, canReadDocument, isValidId } from '../services/access.js'
import { resolveUploadPath, uploadsDirectory } from '../utils/uploads.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { db } from '../db/index.js'
import { documents, clients, users, documentFolders, clientServices, serviceTypes, clientUsers } from '../db/schema.js'
import { requireAuth } from '../middleware/auth.js'
import { eq, and, desc, isNull, inArray, sql } from 'drizzle-orm'

const router = Router()
for (const param of ['clientId', 'clientServiceId', 'documentId', 'folderId']) router.param(param, (_req, res, next, value) => {
  if (!/^\d+$/.test(value) || !isValidId(Number(value))) return res.status(400).json({ error: `Invalid ${param}` })
  next()
})

async function cleanupDeletedDocumentFiles(urls: string[]) {
  if (!urls.length) return
  // The database commit comes first: a failed delete must never lose the file.
  // Historical imports can share one URL, so retain files still in use.
  try {
    const remaining = await db.select({ url: documents.url }).from(documents).where(inArray(documents.url, urls))
    const retained = new Set(remaining.map(document => document.url))
    for (const url of new Set(urls)) {
      if (retained.has(url)) continue
      try { await fs.promises.unlink(resolveUploadPath(url)) }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') console.error('[DOCUMENTS] Deleted metadata; file cleanup requires retry') }
    }
  } catch { console.error('[DOCUMENTS] Deleted metadata; file cleanup requires retry') }
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(uploadsDirectory, 'documents')
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
      .where(eq(documents.clientId, Number(clientId)))
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
    const { clientId, clientServiceId, folderId, visibleToClient, type, documentTitle } = req.body

    if (!clientId) {
      if (req.file) fs.unlinkSync(req.file.path)
      return res.status(400).json({ error: 'Client ID is required' })
    }

    if (!isValidId(Number(clientId)) || (clientServiceId && !isValidId(Number(clientServiceId))) || (folderId && (!clientServiceId || !isValidId(Number(folderId))))) {
      if (req.file) fs.unlinkSync(req.file.path)
      return res.status(400).json({ error: 'Valid client, service and folder IDs are required.' })
    }
    if (!await canAccessClient(user, Number(clientId), 'write') ||
        (clientServiceId && !await canAccessService(user, Number(clientServiceId), 'write'))) {
      if (req.file) fs.unlinkSync(req.file.path)
      return res.status(403).json({ error: 'Document upload access denied' })
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    // Verify client exists
    const client = await db
      .select()
      .from(clients)
      .where(eq(clients.id, Number(clientId)))
      .limit(1)

    if (client.length === 0) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path)
      return res.status(404).json({ error: 'Client not found' })
    }

    // If clientServiceId provided, verify it exists and belongs to this client
    if (clientServiceId) {
      const service = await db
        .select()
        .from(clientServices)
        .where(and(
          eq(clientServices.id, Number(clientServiceId)),
          eq(clientServices.clientId, Number(clientId))
        ))
        .limit(1)

      if (service.length === 0) {
        fs.unlinkSync(req.file.path)
        return res.status(404).json({ error: 'Service not found for this client' })
      }
    }

    // If folderId provided, verify it exists and belongs to the service
    if (folderId && clientServiceId) {
      const folder = await db
        .select()
        .from(documentFolders)
        .where(and(
          eq(documentFolders.id, Number(folderId)),
          eq(documentFolders.clientServiceId, Number(clientServiceId))
        ))
        .limit(1)

      if (folder.length === 0) {
        fs.unlinkSync(req.file.path)
        return res.status(404).json({ error: 'Folder not found for this service' })
      }
    }

    // Create document record
    const [newDocument] = await db
      .insert(documents)
      .values({
        name: req.file.originalname,
        documentTitle: documentTitle || null,
        type: type || null,
        fileSize: req.file.size,
        url: `/uploads/documents/${req.file.filename}`,
        userId: user.id,
        clientId: Number(clientId),
        clientServiceId: clientServiceId ? Number(clientServiceId) : null,
        folderId: folderId ? Number(folderId) : null,
        visibleToClient: user.role === 'client' || visibleToClient === 'true' || visibleToClient === true,
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
    const { documentId } = req.params

    const document = await db
      .select()
      .from(documents)
      .where(eq(documents.id, Number(documentId)))
      .limit(1)

    if (document.length === 0) {
      return res.status(404).json({ error: 'Document not found' })
    }

    if (!await canReadDocument(user, document[0])) {
      return res.status(403).json({ error: 'Access denied' })
    }
    res.setHeader('Cache-Control', 'private, no-store')

    const filePath = resolveUploadPath(document[0].url)

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
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(document[0].name)}`)
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
    const { documentId } = req.params

    const document = await db
      .select()
      .from(documents)
      .where(eq(documents.id, Number(documentId)))
      .limit(1)

    if (document.length === 0) {
      return res.status(404).json({ error: 'Document not found' })
    }

    if (!await canReadDocument(user, document[0])) {
      return res.status(403).json({ error: 'Access denied' })
    }
    res.setHeader('Cache-Control', 'private, no-store')

    const filePath = resolveUploadPath(document[0].url)

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

    const deleted = await db.transaction(async tx => tx.delete(documents)
      .where(eq(documents.id, Number(documentId))).returning({ url: documents.url }))
    if (!deleted.length) return res.status(404).json({ error: 'Document not found' })
    await cleanupDeletedDocumentFiles(deleted.map(document => document.url))

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
    if ((name !== undefined && (typeof name !== 'string' || !name.trim())) || (type !== undefined && typeof type !== 'string')) return res.status(400).json({ error: 'Valid document name and type are required' })

    const updateData: any = { lastUpdated: new Date() }
    if (name) updateData.name = name.trim()
    if (type !== undefined) updateData.type = type.trim() || null

    const [updatedDocument] = await db
      .update(documents)
      .set(updateData)
      .where(eq(documents.id, Number(documentId)))
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

// ============================================
// Service-level Document Management Endpoints
// ============================================

// Get all folders and documents for a service (Admin only)
router.get('/service/:clientServiceId', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { clientServiceId } = req.params

    // Verify service exists
    const service = await db
      .select()
      .from(clientServices)
      .where(eq(clientServices.id, Number(clientServiceId)))
      .limit(1)

    if (service.length === 0) {
      return res.status(404).json({ error: 'Service not found' })
    }

    // Get all folders for this service
    const folders = await db
      .select({
        folder: documentFolders,
        createdBy: {
          id: users.id,
          fullName: users.fullName,
        }
      })
      .from(documentFolders)
      .leftJoin(users, eq(documentFolders.createdBy, users.id))
      .where(eq(documentFolders.clientServiceId, Number(clientServiceId)))
      .orderBy(documentFolders.name)

    // Get all documents for this service
    const serviceDocuments = await db
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
      .where(eq(documents.clientServiceId, Number(clientServiceId)))
      .orderBy(desc(documents.createdAt))

    // Separate documents by folder
    const documentsInFolders: Record<number, typeof serviceDocuments> = {}
    const rootDocuments: typeof serviceDocuments = []

    for (const doc of serviceDocuments) {
      if (doc.document.folderId) {
        if (!documentsInFolders[doc.document.folderId]) {
          documentsInFolders[doc.document.folderId] = []
        }
        documentsInFolders[doc.document.folderId].push(doc)
      } else {
        rootDocuments.push(doc)
      }
    }

    // Build folder tree with documents
    const foldersWithDocs = folders.map(f => ({
      ...f.folder,
      createdBy: f.createdBy,
      documents: documentsInFolders[f.folder.id] || []
    }))

    res.json({
      folders: foldersWithDocs,
      rootDocuments,
      service: service[0]
    })
  } catch (error) {
    console.error('Error fetching service documents:', error)
    res.status(500).json({ error: 'Failed to fetch service documents' })
  }
})

// Get client-visible documents for a service (Client access)
router.get('/service/:clientServiceId/client-visible', requireAuth, async (req, res) => {
  try {
    const { clientServiceId } = req.params

    if (!await canAccessService(req.user, Number(clientServiceId))) return res.status(403).json({ error: 'Access denied' })

    // Verify service exists
    const service = await db
      .select({
        service: clientServices,
        serviceType: serviceTypes
      })
      .from(clientServices)
      .leftJoin(serviceTypes, eq(clientServices.serviceTypeId, serviceTypes.id))
      .where(eq(clientServices.id, Number(clientServiceId)))
      .limit(1)

    if (service.length === 0) {
      return res.status(404).json({ error: 'Service not found' })
    }

    // Get folders for this service
    const folders = await db
      .select()
      .from(documentFolders)
      .where(eq(documentFolders.clientServiceId, Number(clientServiceId)))
      .orderBy(documentFolders.name)

    // Get only client-visible documents
    const serviceDocuments = await db
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
      .where(and(
        eq(documents.clientServiceId, Number(clientServiceId)),
        eq(documents.visibleToClient, true)
      ))
      .orderBy(desc(documents.createdAt))

    // Separate documents by folder
    const documentsInFolders: Record<number, typeof serviceDocuments> = {}
    const rootDocuments: typeof serviceDocuments = []

    for (const doc of serviceDocuments) {
      if (doc.document.folderId) {
        if (!documentsInFolders[doc.document.folderId]) {
          documentsInFolders[doc.document.folderId] = []
        }
        documentsInFolders[doc.document.folderId].push(doc)
      } else {
        rootDocuments.push(doc)
      }
    }

    // Filter folders to only include those with visible documents
    const foldersWithDocs = folders
      .map(f => ({
        ...f,
        documents: documentsInFolders[f.id] || []
      }))


    res.json({
      folders: foldersWithDocs,
      rootDocuments,
      service: {
        ...clientServiceDto(service[0].service),
        serviceTypeName: service[0].serviceType?.name,
        serviceCategory: service[0].serviceType?.category
      }
    })
  } catch (error) {
    console.error('Error fetching client-visible documents:', error)
    res.status(500).json({ error: 'Failed to fetch documents' })
  }
})

// Create a folder
router.post('/folder', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { clientServiceId, name, parentFolderId } = req.body

    if (!isValidId(Number(clientServiceId)) || typeof name !== 'string' || !name.trim() || name.trim().length > 255 || (parentFolderId && !isValidId(Number(parentFolderId)))) {
      return res.status(400).json({ error: 'Service ID and folder name are required' })
    }

    // Verify service exists
    const service = await db
      .select()
      .from(clientServices)
      .where(eq(clientServices.id, Number(clientServiceId)))
      .limit(1)

    if (service.length === 0) {
      return res.status(404).json({ error: 'Service not found' })
    }

    // If parent folder provided, verify it exists and belongs to same service
    if (parentFolderId) {
      const parentFolder = await db
        .select()
        .from(documentFolders)
        .where(and(
          eq(documentFolders.id, Number(parentFolderId)),
          eq(documentFolders.clientServiceId, Number(clientServiceId))
        ))
        .limit(1)

      if (parentFolder.length === 0) {
        return res.status(404).json({ error: 'Parent folder not found' })
      }
    }

    const [newFolder] = await db
      .insert(documentFolders)
      .values({
        clientServiceId: Number(clientServiceId),
        name: name.trim(),
        parentFolderId: parentFolderId ? Number(parentFolderId) : null,
        createdBy: user.id,
      })
      .returning()

    res.json({
      ...newFolder,
      createdBy: {
        id: user.id,
        fullName: user.fullName,
      }
    })
  } catch (error) {
    console.error('Error creating folder:', error)
    res.status(500).json({ error: 'Failed to create folder' })
  }
})

// Rename a folder
router.put('/folder/:folderId', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { folderId } = req.params
    const { name } = req.body

    if (typeof name !== 'string' || !name.trim() || name.trim().length > 255) {
      return res.status(400).json({ error: 'Folder name must contain 1–255 characters' })
    }

    const [updatedFolder] = await db
      .update(documentFolders)
      .set({ name: name.trim() })
      .where(eq(documentFolders.id, Number(folderId)))
      .returning()

    if (!updatedFolder) {
      return res.status(404).json({ error: 'Folder not found' })
    }

    res.json(updatedFolder)
  } catch (error) {
    console.error('Error renaming folder:', error)
    res.status(500).json({ error: 'Failed to rename folder' })
  }
})

// Delete a folder
router.delete('/folder/:folderId', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { folderId } = req.params
    const { deleteContents } = req.query
    if (deleteContents !== undefined && !['true', 'false'].includes(String(deleteContents))) return res.status(400).json({ error: 'deleteContents must be true or false' })

    const deletedUrls = await db.transaction(async tx => {
      // Serialize tree changes with all inserts/updates, including uploads. Reads
      // remain available while the tree and documents move or delete atomically.
      await tx.execute(sql`LOCK TABLE document_folders, documents IN SHARE ROW EXCLUSIVE MODE`)
      const [folder] = await tx.select().from(documentFolders).where(eq(documentFolders.id, Number(folderId)))
      if (!folder) throw Object.assign(new Error('Folder not found'), { status: 404 })
      const allFolders = await tx.select().from(documentFolders)
      const descendants = [folder.id], visited = new Set(descendants)
      for (let index = 0; index < descendants.length; index++) {
        for (const child of allFolders.filter(item => item.parentFolderId === descendants[index])) {
          if (visited.has(child.id) || child.clientServiceId !== folder.clientServiceId) throw Object.assign(new Error('Folder hierarchy is inconsistent; repair it before deleting'), { status: 409 })
          visited.add(child.id); descendants.push(child.id)
        }
      }
      const parent = folder.parentFolderId ? allFolders.find(item => item.id === folder.parentFolderId) : null
      if (folder.parentFolderId && (!parent || parent.clientServiceId !== folder.clientServiceId || visited.has(parent.id))) throw Object.assign(new Error('Folder parent belongs to an invalid hierarchy'), { status: 409 })
      const contents = await tx.select().from(documents).where(inArray(documents.folderId, descendants))
      if (contents.some(document => document.clientServiceId !== folder.clientServiceId)) throw Object.assign(new Error('Folder contains documents from another service'), { status: 409 })
      if (deleteContents === 'true') {
        await tx.delete(documents).where(inArray(documents.folderId, descendants))
        await tx.delete(documentFolders).where(inArray(documentFolders.id, descendants))
        return contents.map(document => document.url)
      }
      await tx.update(documents).set({ folderId: folder.parentFolderId, lastUpdated: new Date() }).where(eq(documents.folderId, folder.id))
      await tx.update(documentFolders).set({ parentFolderId: folder.parentFolderId }).where(eq(documentFolders.parentFolderId, folder.id))
      await tx.delete(documentFolders).where(eq(documentFolders.id, folder.id))
      return []
    })
    await cleanupDeletedDocumentFiles(deletedUrls)

    res.json({ message: 'Folder deleted successfully' })
  } catch (error) {
    console.error('Error deleting folder:', error)
    res.status((error as any).status || 500).json({ error: (error as any).status ? (error as Error).message : 'Failed to delete folder' })
  }
})

// Toggle document visibility for client
router.patch('/:documentId/visibility', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const { documentId } = req.params
    const { visibleToClient } = req.body

    if (typeof visibleToClient !== 'boolean') {
      return res.status(400).json({ error: 'visibleToClient must be a boolean' })
    }

    const [updatedDocument] = await db
      .update(documents)
      .set({ visibleToClient })
      .where(eq(documents.id, Number(documentId)))
      .returning()

    if (!updatedDocument) {
      return res.status(404).json({ error: 'Document not found' })
    }

    res.json(updatedDocument)
  } catch (error) {
    console.error('Error updating document visibility:', error)
    res.status(500).json({ error: 'Failed to update document visibility' })
  }
})

// Get all clients with their services for admin documents page
router.get('/clients-with-services', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    // Get all active clients
    const allClients = await db
      .select()
      .from(clients)
      .where(eq(clients.status, 'active'))
      .orderBy(clients.name)

    // Get all services with their types (including inactive ones for document access)
    const allServices = await db
      .select({
        service: clientServices,
        serviceType: serviceTypes
      })
      .from(clientServices)
      .leftJoin(serviceTypes, eq(clientServices.serviceTypeId, serviceTypes.id))

    // Group services by client
    const clientsWithServices = allClients.map(client => ({
      ...client,
      services: allServices
        .filter(s => s.service.clientId === client.id)
        .map(s => ({
          ...s.service,
          serviceTypeName: s.serviceType?.name,
          serviceCategory: s.serviceType?.category,
          billingModel: s.serviceType?.billingModel
        }))
    }))

    res.json(clientsWithServices)
  } catch (error) {
    console.error('Error fetching clients with services:', error)
    res.status(500).json({ error: 'Failed to fetch clients' })
  }
})

export { router as documentsRouter }
