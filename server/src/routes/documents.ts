import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { db } from '../db/index.js'
import { documents, clients, users, documentFolders, clientServices, serviceTypes, clientUsers } from '../db/schema.js'
import { requireAuth } from '../middleware/auth.js'
import { eq, and, desc, isNull } from 'drizzle-orm'

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
    const { clientId, clientServiceId, folderId, visibleToClient, type, documentTitle } = req.body

    if (!clientId) {
      return res.status(400).json({ error: 'Client ID is required' })
    }

    // Check access permissions
    if (user.role === 'admin' || user.role === 'team_member') {
      // Admins and team members can upload to any client
    } else if (user.role === 'client') {
      // Client users need 'write' or 'admin' access level
      const clientAccess = await db
        .select()
        .from(clientUsers)
        .where(and(
          eq(clientUsers.userId, user.id),
          eq(clientUsers.clientId, parseInt(clientId)),
          eq(clientUsers.isActive, true)
        ))
        .limit(1)

      if (clientAccess.length === 0) {
        if (req.file) fs.unlinkSync(req.file.path)
        return res.status(403).json({ error: 'Access denied to this client' })
      }

      const accessLevel = clientAccess[0].accessLevel
      if (accessLevel !== 'write' && accessLevel !== 'admin') {
        if (req.file) fs.unlinkSync(req.file.path)
        return res.status(403).json({ error: 'You do not have permission to upload documents. Write or admin access is required.' })
      }
    } else {
      if (req.file) fs.unlinkSync(req.file.path)
      return res.status(403).json({ error: 'Access denied' })
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
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

    // If clientServiceId provided, verify it exists and belongs to this client
    if (clientServiceId) {
      const service = await db
        .select()
        .from(clientServices)
        .where(and(
          eq(clientServices.id, parseInt(clientServiceId)),
          eq(clientServices.clientId, parseInt(clientId))
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
          eq(documentFolders.id, parseInt(folderId)),
          eq(documentFolders.clientServiceId, parseInt(clientServiceId))
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
        clientId: parseInt(clientId),
        clientServiceId: clientServiceId ? parseInt(clientServiceId) : null,
        folderId: folderId ? parseInt(folderId) : null,
        visibleToClient: visibleToClient === 'true' || visibleToClient === true,
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
      .where(eq(documents.id, parseInt(documentId)))
      .limit(1)

    if (document.length === 0) {
      return res.status(404).json({ error: 'Document not found' })
    }

    // Check access: admin can access all, client can only access visible documents
    if (user.role !== 'admin') {
      if (!document[0].visibleToClient) {
        return res.status(403).json({ error: 'Access denied' })
      }
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
    const { documentId } = req.params

    const document = await db
      .select()
      .from(documents)
      .where(eq(documents.id, parseInt(documentId)))
      .limit(1)

    if (document.length === 0) {
      return res.status(404).json({ error: 'Document not found' })
    }

    // Check access: admin can access all, client can only access visible documents
    if (user.role !== 'admin') {
      if (!document[0].visibleToClient) {
        return res.status(403).json({ error: 'Access denied' })
      }
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
      .where(eq(clientServices.id, parseInt(clientServiceId)))
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
      .where(eq(documentFolders.clientServiceId, parseInt(clientServiceId)))
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
      .where(eq(documents.clientServiceId, parseInt(clientServiceId)))
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

    // Verify service exists
    const service = await db
      .select({
        service: clientServices,
        serviceType: serviceTypes
      })
      .from(clientServices)
      .leftJoin(serviceTypes, eq(clientServices.serviceTypeId, serviceTypes.id))
      .where(eq(clientServices.id, parseInt(clientServiceId)))
      .limit(1)

    if (service.length === 0) {
      return res.status(404).json({ error: 'Service not found' })
    }

    // Get folders for this service
    const folders = await db
      .select()
      .from(documentFolders)
      .where(eq(documentFolders.clientServiceId, parseInt(clientServiceId)))
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
        eq(documents.clientServiceId, parseInt(clientServiceId)),
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
      .filter(f => f.documents.length > 0)

    res.json({
      folders: foldersWithDocs,
      rootDocuments,
      service: {
        ...service[0].service,
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

    if (!clientServiceId || !name) {
      return res.status(400).json({ error: 'Service ID and folder name are required' })
    }

    // Verify service exists
    const service = await db
      .select()
      .from(clientServices)
      .where(eq(clientServices.id, parseInt(clientServiceId)))
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
          eq(documentFolders.id, parseInt(parentFolderId)),
          eq(documentFolders.clientServiceId, parseInt(clientServiceId))
        ))
        .limit(1)

      if (parentFolder.length === 0) {
        return res.status(404).json({ error: 'Parent folder not found' })
      }
    }

    const [newFolder] = await db
      .insert(documentFolders)
      .values({
        clientServiceId: parseInt(clientServiceId),
        name: name.trim(),
        parentFolderId: parentFolderId ? parseInt(parentFolderId) : null,
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

    if (!name) {
      return res.status(400).json({ error: 'Folder name is required' })
    }

    const [updatedFolder] = await db
      .update(documentFolders)
      .set({ name: name.trim() })
      .where(eq(documentFolders.id, parseInt(folderId)))
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

    // Get the folder
    const folder = await db
      .select()
      .from(documentFolders)
      .where(eq(documentFolders.id, parseInt(folderId)))
      .limit(1)

    if (folder.length === 0) {
      return res.status(404).json({ error: 'Folder not found' })
    }

    if (deleteContents === 'true') {
      // Delete all documents in folder and their files
      const docsToDelete = await db
        .select()
        .from(documents)
        .where(eq(documents.folderId, parseInt(folderId)))

      for (const doc of docsToDelete) {
        const filePath = path.join(process.cwd(), doc.url)
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      }

      await db
        .delete(documents)
        .where(eq(documents.folderId, parseInt(folderId)))

      // Delete child folders recursively
      await deleteChildFolders(parseInt(folderId))
    } else {
      // Move documents to parent folder or root (null)
      await db
        .update(documents)
        .set({ folderId: folder[0].parentFolderId })
        .where(eq(documents.folderId, parseInt(folderId)))

      // Move child folders to parent
      await db
        .update(documentFolders)
        .set({ parentFolderId: folder[0].parentFolderId })
        .where(eq(documentFolders.parentFolderId, parseInt(folderId)))
    }

    // Delete the folder
    await db
      .delete(documentFolders)
      .where(eq(documentFolders.id, parseInt(folderId)))

    res.json({ message: 'Folder deleted successfully' })
  } catch (error) {
    console.error('Error deleting folder:', error)
    res.status(500).json({ error: 'Failed to delete folder' })
  }
})

// Helper function to recursively delete child folders
async function deleteChildFolders(parentFolderId: number) {
  const childFolders = await db
    .select()
    .from(documentFolders)
    .where(eq(documentFolders.parentFolderId, parentFolderId))

  for (const child of childFolders) {
    // Delete documents in child folder
    const docsToDelete = await db
      .select()
      .from(documents)
      .where(eq(documents.folderId, child.id))

    for (const doc of docsToDelete) {
      const filePath = path.join(process.cwd(), doc.url)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    }

    await db
      .delete(documents)
      .where(eq(documents.folderId, child.id))

    // Recursively delete grandchildren
    await deleteChildFolders(child.id)

    // Delete child folder
    await db
      .delete(documentFolders)
      .where(eq(documentFolders.id, child.id))
  }
}

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
      .where(eq(documents.id, parseInt(documentId)))
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