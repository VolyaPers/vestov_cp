import express from 'express'
import { db } from '../db/index.js'
import { reimbursementRequests, teamMembers, users } from '../db/schema.js'
import { eq, and, sql, desc } from 'drizzle-orm'
import { calculateEmploymentMetrics } from '../utils/employment.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'

const router = express.Router()

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), 'uploads')
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true })
    }
    cb(null, uploadPath)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, 'evidence-' + uniqueSuffix + path.extname(file.originalname))
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    const mimetype = allowedTypes.test(file.mimetype)

    if (mimetype && extname) {
      return cb(null, true)
    } else {
      cb(new Error('Only .png, .jpg, .jpeg and .pdf format allowed!'))
    }
  }
})

// Helper function to get yearly limit based on years at company
function getYearlyLimit(yearsAtCompany: number): number {
  if (yearsAtCompany >= 5) return 700
  if (yearsAtCompany >= 4) return 600
  if (yearsAtCompany >= 3) return 500
  if (yearsAtCompany >= 2) return 400
  return 300 // 1 year
}

// GET /api/reimbursements/limits/:year - Get available limit for current employee
router.get('/limits/:year', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const year = parseInt(req.params.year)

    // Get team member info by matching email
    const members = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.email, req.user.email!))

    const member = members[0]

    if (!member) {
      return res.status(404).json({ error: 'Team member not found' })
    }

    // Calculate years at company and limit
    const yearsAtCompany = calculateEmploymentMetrics(member.startDate).careerYear
    const yearlyLimit = getYearlyLimit(yearsAtCompany)

    // Calculate total used in the specified year
    const usedResult = await db
      .select({
        total: sql<string>`COALESCE(SUM(${reimbursementRequests.reimbursementAmount}), 0)`
      })
      .from(reimbursementRequests)
      .where(
        and(
          eq(reimbursementRequests.employeeId, member.id),
          eq(reimbursementRequests.year, year),
          sql`${reimbursementRequests.status} IN ('pending', 'approved', 'confirmed')`
        )
      )

    const usedAmount = parseFloat(usedResult[0].total)
    const availableAmount = yearlyLimit - usedAmount

    res.json({
      yearsAtCompany,
      yearlyLimit,
      usedAmount,
      availableAmount,
      year
    })
  } catch (error) {
    console.error('Error fetching reimbursement limits:', error)
    res.status(500).json({ error: 'Failed to fetch reimbursement limits' })
  }
})

// GET /api/reimbursements/my-requests - Get current employee's requests
router.get('/my-requests', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    // Get team member info by matching email
    const members = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.email, req.user.email!))

    const member = members[0]

    if (!member) {
      return res.status(404).json({ error: 'Team member not found' })
    }

    // Get all requests for this employee
    const requests = await db
      .select({
        id: reimbursementRequests.id,
        year: reimbursementRequests.year,
        expenseAmount: reimbursementRequests.expenseAmount,
        reimbursementAmount: reimbursementRequests.reimbursementAmount,
        description: reimbursementRequests.description,
        category: reimbursementRequests.category,
        status: reimbursementRequests.status,
        requestedAt: reimbursementRequests.requestedAt,
        approvedAt: reimbursementRequests.approvedAt,
        approvalNote: reimbursementRequests.approvalNote,
        evidenceUrl: reimbursementRequests.evidenceUrl,
        confirmedAt: reimbursementRequests.confirmedAt,
        approverName: users.fullName
      })
      .from(reimbursementRequests)
      .leftJoin(users, eq(reimbursementRequests.approvedBy, users.id))
      .where(eq(reimbursementRequests.employeeId, member.id))
      .orderBy(desc(reimbursementRequests.requestedAt))

    res.json(requests)
  } catch (error) {
    console.error('Error fetching reimbursement requests:', error)
    res.status(500).json({ error: 'Failed to fetch reimbursement requests' })
  }
})

// POST /api/reimbursements - Create new reimbursement request
router.post('/', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const { expenseAmount, description, category } = req.body
    const year = new Date().getFullYear()

    // Validate inputs
    if (!expenseAmount || !description) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const expense = parseFloat(expenseAmount)
    if (isNaN(expense) || expense <= 0) {
      return res.status(400).json({ error: 'Invalid expense amount' })
    }

    // Get team member info by matching email
    const members = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.email, req.user.email!))

    const member = members[0]

    if (!member) {
      return res.status(404).json({ error: 'Team member not found' })
    }

    // Calculate years at company and limit
    const yearsAtCompany = calculateEmploymentMetrics(member.startDate).careerYear
    const yearlyLimit = getYearlyLimit(yearsAtCompany)

    // Calculate total used in current year
    const usedResult = await db
      .select({
        total: sql<string>`COALESCE(SUM(${reimbursementRequests.reimbursementAmount}), 0)`
      })
      .from(reimbursementRequests)
      .where(
        and(
          eq(reimbursementRequests.employeeId, member.id),
          eq(reimbursementRequests.year, year),
          sql`${reimbursementRequests.status} IN ('pending', 'approved', 'confirmed')`
        )
      )

    const usedAmount = parseFloat(usedResult[0].total)
    const availableAmount = yearlyLimit - usedAmount

    // Calculate 50% reimbursement, capped to available limit
    const halfExpense = expense * 0.5
    const reimbursementAmount = Math.min(halfExpense, availableAmount)

    if (reimbursementAmount <= 0) {
      return res.status(400).json({
        error: 'No reimbursement available',
        details: {
          yearlyLimit,
          usedAmount,
          availableAmount: 0
        }
      })
    }

    // Create reimbursement request
    const [request] = await db
      .insert(reimbursementRequests)
      .values({
        employeeId: member.id,
        year,
        expenseAmount: expense.toFixed(2),
        reimbursementAmount: reimbursementAmount.toFixed(2),
        description,
        category: category || null,
        status: 'pending',
        requestedBy: req.user.id
      })
      .returning()

    res.status(201).json({
      request,
      limits: {
        yearlyLimit,
        usedAmount,
        availableAmount: availableAmount - reimbursementAmount
      }
    })
  } catch (error) {
    console.error('Error creating reimbursement request:', error)
    res.status(500).json({ error: 'Failed to create reimbursement request' })
  }
})

// GET /api/reimbursements - Get all requests (admin only)
router.get('/', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const requests = await db
      .select({
        id: reimbursementRequests.id,
        employeeId: reimbursementRequests.employeeId,
        employeeName: teamMembers.name,
        year: reimbursementRequests.year,
        expenseAmount: reimbursementRequests.expenseAmount,
        reimbursementAmount: reimbursementRequests.reimbursementAmount,
        description: reimbursementRequests.description,
        category: reimbursementRequests.category,
        status: reimbursementRequests.status,
        requestedAt: reimbursementRequests.requestedAt,
        requestedByName: users.fullName,
        approvedAt: reimbursementRequests.approvedAt,
        approvalNote: reimbursementRequests.approvalNote,
        evidenceUrl: reimbursementRequests.evidenceUrl,
        confirmedAt: reimbursementRequests.confirmedAt
      })
      .from(reimbursementRequests)
      .innerJoin(teamMembers, eq(reimbursementRequests.employeeId, teamMembers.id))
      .innerJoin(users, eq(reimbursementRequests.requestedBy, users.id))
      .orderBy(desc(reimbursementRequests.requestedAt))

    res.json(requests)
  } catch (error) {
    console.error('Error fetching reimbursement requests:', error)
    res.status(500).json({ error: 'Failed to fetch reimbursement requests' })
  }
})

// PUT /api/reimbursements/:id/approve - Approve request (admin only)
router.put('/:id/approve', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const id = parseInt(req.params.id)
    const { note } = req.body

    // Get current request
    const [request] = await db
      .select()
      .from(reimbursementRequests)
      .where(eq(reimbursementRequests.id, id))

    if (!request) {
      return res.status(404).json({ error: 'Request not found' })
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request is not pending' })
    }

    // Approve request
    const [updated] = await db
      .update(reimbursementRequests)
      .set({
        status: 'approved',
        approvedBy: req.user.id,
        approvedAt: new Date(),
        approvalNote: note || null,
        updatedAt: new Date()
      })
      .where(eq(reimbursementRequests.id, id))
      .returning()

    res.json(updated)
  } catch (error) {
    console.error('Error approving reimbursement request:', error)
    res.status(500).json({ error: 'Failed to approve reimbursement request' })
  }
})

// PUT /api/reimbursements/:id/reject - Reject request (admin only)
router.put('/:id/reject', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const id = parseInt(req.params.id)
    const { note } = req.body

    if (!note) {
      return res.status(400).json({ error: 'Rejection reason is required' })
    }

    // Get current request
    const [request] = await db
      .select()
      .from(reimbursementRequests)
      .where(eq(reimbursementRequests.id, id))

    if (!request) {
      return res.status(404).json({ error: 'Request not found' })
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request is not pending' })
    }

    // Reject request
    const [updated] = await db
      .update(reimbursementRequests)
      .set({
        status: 'rejected',
        approvedBy: req.user.id,
        approvedAt: new Date(),
        approvalNote: note,
        updatedAt: new Date()
      })
      .where(eq(reimbursementRequests.id, id))
      .returning()

    res.json(updated)
  } catch (error) {
    console.error('Error rejecting reimbursement request:', error)
    res.status(500).json({ error: 'Failed to reject reimbursement request' })
  }
})

// POST /api/reimbursements/:id/upload - Upload evidence (employee only, for approved requests)
router.post('/:id/upload', upload.single('evidence'), async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const id = parseInt(req.params.id)

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    // Get current request
    const [request] = await db
      .select({
        request: reimbursementRequests,
        member: teamMembers
      })
      .from(reimbursementRequests)
      .innerJoin(teamMembers, eq(reimbursementRequests.employeeId, teamMembers.id))
      .where(eq(reimbursementRequests.id, id))

    if (!request) {
      return res.status(404).json({ error: 'Request not found' })
    }

    // Verify this request belongs to the current user (match by email)
    if (request.member.email !== req.user.email) {
      return res.status(403).json({ error: 'Not authorized to upload evidence for this request' })
    }

    if (request.request.status !== 'approved') {
      return res.status(400).json({ error: 'Request must be approved before uploading evidence' })
    }

    // Save file path and mark as confirmed
    const evidenceUrl = `/uploads/${req.file.filename}`
    const [updated] = await db
      .update(reimbursementRequests)
      .set({
        evidenceUrl,
        confirmedAt: new Date(),
        status: 'confirmed',
        updatedAt: new Date()
      })
      .where(eq(reimbursementRequests.id, id))
      .returning()

    res.json(updated)
  } catch (error) {
    console.error('Error uploading evidence:', error)
    res.status(500).json({ error: 'Failed to upload evidence' })
  }
})

export default router
