import express from 'express'
import { db, pool } from '../db/index.js'
import { reimbursementRequests, teamMembers, users } from '../db/schema.js'
import { eq, and, or, sql, desc, like } from 'drizzle-orm'
import { calculateEmploymentMetrics } from '../utils/employment.js'
import { notifyReimbursementRequest } from '../utils/slack.js'
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

    // Calculate total used in the current career year (not calendar year)
    // Fallback to calendar year if careerYear column doesn't exist yet
    let usedResult
    try {
      usedResult = await db
        .select({
          total: sql<string>`COALESCE(SUM(${reimbursementRequests.reimbursementAmount}), 0)`
        })
        .from(reimbursementRequests)
        .where(
          and(
            eq(reimbursementRequests.employeeId, member.id),
            eq(reimbursementRequests.careerYear, yearsAtCompany),
            sql`${reimbursementRequests.status} IN ('pending', 'approved', 'confirmed')`
          )
        )
    } catch (error: any) {
      // If careerYear column doesn't exist, use calendar year as fallback
      if (error?.code === '42703' && error?.message?.includes('career_year')) {
        usedResult = await db
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
      } else {
        throw error
      }
    }

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
    // Try to select careerYear, but handle case where column doesn't exist yet
    try {
      const requests = await db
        .select({
          id: reimbursementRequests.id,
          year: reimbursementRequests.year,
          careerYear: reimbursementRequests.careerYear,
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
    } catch (error: any) {
      // If careerYear column doesn't exist, select without it
      if (error?.code === '42703' && error?.message?.includes('career_year')) {
        const requests = await db
          .select({
            id: reimbursementRequests.id,
            year: reimbursementRequests.year,
            careerYear: sql<number | null>`NULL::integer`.as('careerYear'),
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
      } else {
        throw error
      }
    }
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

    // Calculate total used in current career year (not calendar year)
    // Fallback to calendar year if careerYear column doesn't exist yet
    let usedResult
    try {
      usedResult = await db
        .select({
          total: sql<string>`COALESCE(SUM(${reimbursementRequests.reimbursementAmount}), 0)`
        })
        .from(reimbursementRequests)
        .where(
          and(
            eq(reimbursementRequests.employeeId, member.id),
            eq(reimbursementRequests.careerYear, yearsAtCompany),
            sql`${reimbursementRequests.status} IN ('pending', 'approved', 'confirmed')`
          )
        )
    } catch (error: any) {
      // If careerYear column doesn't exist, use calendar year as fallback
      if (error?.code === '42703' && error?.message?.includes('career_year')) {
        usedResult = await db
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
      } else {
        throw error
      }
    }

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
    // Try to include careerYear, but handle case where column doesn't exist yet
    try {
      const result = await db
        .insert(reimbursementRequests)
        .values({
          employeeId: member.id,
          year,
          careerYear: yearsAtCompany, // Store the career year when request was made
          expenseAmount: expense.toFixed(2),
          reimbursementAmount: reimbursementAmount.toFixed(2),
          description,
          category: category || null,
          status: 'pending',
          requestedBy: req.user.id
        })
        .returning({
          id: reimbursementRequests.id,
          employeeId: reimbursementRequests.employeeId,
          year: reimbursementRequests.year,
          careerYear: reimbursementRequests.careerYear,
          expenseAmount: reimbursementRequests.expenseAmount,
          reimbursementAmount: reimbursementRequests.reimbursementAmount,
          description: reimbursementRequests.description,
          category: reimbursementRequests.category,
          status: reimbursementRequests.status,
          requestedBy: reimbursementRequests.requestedBy,
          requestedAt: reimbursementRequests.requestedAt,
          approvedBy: reimbursementRequests.approvedBy,
          approvedAt: reimbursementRequests.approvedAt,
          approvalNote: reimbursementRequests.approvalNote,
          evidenceUrl: reimbursementRequests.evidenceUrl,
          confirmedAt: reimbursementRequests.confirmedAt,
          createdAt: reimbursementRequests.createdAt,
          updatedAt: reimbursementRequests.updatedAt
        })
      const request = result[0]

      // Notify Slack about new reimbursement request (fire and forget)
      notifyReimbursementRequest({
        employeeName: member.name || null,
        employeeEmail: member.email,
        requestId: request.id,
        description,
        amount: reimbursementAmount.toFixed(2)
      }).catch((err) => console.error('[SLACK] reimbursement notify failed:', err))

      res.status(201).json({
        request,
        limits: {
          yearlyLimit,
          usedAmount,
          availableAmount: availableAmount - reimbursementAmount
        }
      })
    } catch (error: unknown) {
      // If careerYear column doesn't exist, insert using raw SQL
      const dbError = error as { code?: string; message?: string }
      if (dbError?.code === '42703' && (dbError?.message?.includes('career_year') || dbError?.message?.includes('careerYear'))) {
        const result = await pool.query(
          `INSERT INTO reimbursement_requests 
           (employee_id, year, expense_amount, reimbursement_amount, description, category, status, requested_by, requested_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), NOW())
           RETURNING id, employee_id, year, expense_amount, reimbursement_amount, description, category, status, requested_by, requested_at, approved_by, approved_at, approval_note, evidence_url, confirmed_at, created_at, updated_at`,
          [
            member.id,
            year,
            expense.toFixed(2),
            reimbursementAmount.toFixed(2),
            description,
            category || null,
            'pending',
            req.user.id
          ]
        )

        const request = result.rows[0]

        // Notify Slack about new reimbursement request (fire and forget)
        notifyReimbursementRequest({
          employeeName: member.name || null,
          employeeEmail: member.email,
          requestId: request.id,
          description,
          amount: reimbursementAmount.toFixed(2)
        }).catch((err) => console.error('[SLACK] reimbursement notify failed:', err))

        res.status(201).json({
          request,
          limits: {
            yearlyLimit,
            usedAmount,
            availableAmount: availableAmount - reimbursementAmount
          }
        })
      } else {
        throw error
      }
    }

  } catch (error) {
    console.error('Error creating reimbursement request:', error)
    res.status(500).json({ error: 'Failed to create reimbursement request' })
  }
})

// GET /api/reimbursements/evidence/:filename - Serve evidence file
router.get('/evidence/:filename', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const { filename } = req.params
    
    // Security: Only allow filenames that start with 'evidence-'
    if (!filename.startsWith('evidence-')) {
      return res.status(400).json({ error: 'Invalid filename' })
    }

    const filePath = path.join(process.cwd(), 'uploads', filename)

    if (!fs.existsSync(filePath)) {
      console.error(`[EVIDENCE] File not found at path: ${filePath}`)
      console.error(`[EVIDENCE] Current working directory: ${process.cwd()}`)
      console.error(`[EVIDENCE] Uploads directory exists: ${fs.existsSync(path.join(process.cwd(), 'uploads'))}`)
      return res.status(404).json({ error: 'File not found' })
    }

    // Verify the file belongs to a reimbursement request that the user has access to
    // Try both with and without leading slash in evidenceUrl
    const requests = await db
      .select({
        request: reimbursementRequests,
        member: teamMembers
      })
      .from(reimbursementRequests)
      .innerJoin(teamMembers, eq(reimbursementRequests.employeeId, teamMembers.id))
      .where(
        or(
          eq(reimbursementRequests.evidenceUrl, `/uploads/${filename}`),
          eq(reimbursementRequests.evidenceUrl, `uploads/${filename}`)
        )
      )
      .limit(1)

    if (requests.length === 0) {
      // If no exact match, try to find by filename only (more flexible)
      const requestsByFilename = await db
        .select({
          request: reimbursementRequests,
          member: teamMembers
        })
        .from(reimbursementRequests)
        .innerJoin(teamMembers, eq(reimbursementRequests.employeeId, teamMembers.id))
        .where(like(reimbursementRequests.evidenceUrl, `%${filename}`))
        .limit(1)

      if (requestsByFilename.length === 0) {
        console.error(`[EVIDENCE] No reimbursement request found for filename: ${filename}`)
        return res.status(404).json({ error: 'Reimbursement request not found' })
      }

      const request = requestsByFilename[0]

      // Check if user has access: either they are the employee who requested it, or they are an admin
      const hasAccess = req.user.role === 'admin' || request.member.email === req.user.email

      if (!hasAccess) {
        return res.status(403).json({ error: 'Not authorized to view this evidence' })
      }

      // Set appropriate content type based on file extension
      const ext = path.extname(filename).toLowerCase()
      let contentType = 'application/octet-stream'

      switch (ext) {
        case '.jpg':
        case '.jpeg':
          contentType = 'image/jpeg'
          break
        case '.png':
          contentType = 'image/png'
          break
        case '.pdf':
          contentType = 'application/pdf'
          break
      }

      res.setHeader('Content-Type', contentType)
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`)
      res.sendFile(path.resolve(filePath))
      return
    }

    const request = requests[0]

    // Check if user has access: either they are the employee who requested it, or they are an admin
    const hasAccess = req.user.role === 'admin' || request.member.email === req.user.email

    if (!hasAccess) {
      return res.status(403).json({ error: 'Not authorized to view this evidence' })
    }

    // Set appropriate content type based on file extension
    const ext = path.extname(filename).toLowerCase()
    let contentType = 'application/octet-stream'

    switch (ext) {
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg'
        break
      case '.png':
        contentType = 'image/png'
        break
      case '.pdf':
        contentType = 'application/pdf'
        break
    }

    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`)
    res.sendFile(path.resolve(filePath))
  } catch (error) {
    console.error('Error serving evidence file:', error)
    res.status(500).json({ error: 'Failed to serve evidence file' })
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

    // Get current request - select specific fields to avoid careerYear if column doesn't exist
    let request
    try {
      const requests = await db
        .select({
          id: reimbursementRequests.id,
          employeeId: reimbursementRequests.employeeId,
          year: reimbursementRequests.year,
          careerYear: reimbursementRequests.careerYear,
          expenseAmount: reimbursementRequests.expenseAmount,
          reimbursementAmount: reimbursementRequests.reimbursementAmount,
          description: reimbursementRequests.description,
          category: reimbursementRequests.category,
          status: reimbursementRequests.status,
          requestedBy: reimbursementRequests.requestedBy,
          requestedAt: reimbursementRequests.requestedAt,
          approvedBy: reimbursementRequests.approvedBy,
          approvedAt: reimbursementRequests.approvedAt,
          approvalNote: reimbursementRequests.approvalNote,
          evidenceUrl: reimbursementRequests.evidenceUrl,
          confirmedAt: reimbursementRequests.confirmedAt,
          createdAt: reimbursementRequests.createdAt,
          updatedAt: reimbursementRequests.updatedAt
        })
        .from(reimbursementRequests)
        .where(eq(reimbursementRequests.id, id))
        .limit(1)
      request = requests[0]
    } catch (error: any) {
      // If careerYear column doesn't exist, select without it
      if (error?.code === '42703' && (error?.message?.includes('career_year') || error?.message?.includes('careerYear'))) {
        const requests = await db
          .select({
            id: reimbursementRequests.id,
            employeeId: reimbursementRequests.employeeId,
            year: reimbursementRequests.year,
            expenseAmount: reimbursementRequests.expenseAmount,
            reimbursementAmount: reimbursementRequests.reimbursementAmount,
            description: reimbursementRequests.description,
            category: reimbursementRequests.category,
            status: reimbursementRequests.status,
            requestedBy: reimbursementRequests.requestedBy,
            requestedAt: reimbursementRequests.requestedAt,
            approvedBy: reimbursementRequests.approvedBy,
            approvedAt: reimbursementRequests.approvedAt,
            approvalNote: reimbursementRequests.approvalNote,
            evidenceUrl: reimbursementRequests.evidenceUrl,
            confirmedAt: reimbursementRequests.confirmedAt,
            createdAt: reimbursementRequests.createdAt,
            updatedAt: reimbursementRequests.updatedAt
          })
          .from(reimbursementRequests)
          .where(eq(reimbursementRequests.id, id))
          .limit(1)
        request = requests[0]
      } else {
        throw error
      }
    }

    if (!request) {
      return res.status(404).json({ error: 'Request not found' })
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request is not pending' })
    }

    // Approve request
    let updated
    try {
      const result = await db
        .update(reimbursementRequests)
        .set({
          status: 'approved',
          approvedBy: req.user.id,
          approvedAt: new Date(),
          approvalNote: note || null,
          updatedAt: new Date()
        })
        .where(eq(reimbursementRequests.id, id))
        .returning({
          id: reimbursementRequests.id,
          employeeId: reimbursementRequests.employeeId,
          year: reimbursementRequests.year,
          careerYear: reimbursementRequests.careerYear,
          expenseAmount: reimbursementRequests.expenseAmount,
          reimbursementAmount: reimbursementRequests.reimbursementAmount,
          description: reimbursementRequests.description,
          category: reimbursementRequests.category,
          status: reimbursementRequests.status,
          requestedBy: reimbursementRequests.requestedBy,
          requestedAt: reimbursementRequests.requestedAt,
          approvedBy: reimbursementRequests.approvedBy,
          approvedAt: reimbursementRequests.approvedAt,
          approvalNote: reimbursementRequests.approvalNote,
          evidenceUrl: reimbursementRequests.evidenceUrl,
          confirmedAt: reimbursementRequests.confirmedAt,
          createdAt: reimbursementRequests.createdAt,
          updatedAt: reimbursementRequests.updatedAt
        })
      updated = result[0]
    } catch (error: any) {
      // If careerYear column doesn't exist, use SQL raw
      if (error?.code === '42703' && (error?.message?.includes('career_year') || error?.message?.includes('careerYear'))) {
        const result = await pool.query(
          `UPDATE reimbursement_requests 
           SET status = 'approved', approved_by = $1, approved_at = NOW(), approval_note = $2, updated_at = NOW()
           WHERE id = $3
           RETURNING id, employee_id, year, expense_amount, reimbursement_amount, description, category, status, requested_by, requested_at, approved_by, approved_at, approval_note, evidence_url, confirmed_at, created_at, updated_at`,
          [req.user.id, note || null, id]
        )
        updated = result.rows[0]
      } else {
        throw error
      }
    }

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

    // Get current request - select specific fields to avoid careerYear if column doesn't exist
    let request
    try {
      const requests = await db
        .select({
          id: reimbursementRequests.id,
          employeeId: reimbursementRequests.employeeId,
          year: reimbursementRequests.year,
          careerYear: reimbursementRequests.careerYear,
          expenseAmount: reimbursementRequests.expenseAmount,
          reimbursementAmount: reimbursementRequests.reimbursementAmount,
          description: reimbursementRequests.description,
          category: reimbursementRequests.category,
          status: reimbursementRequests.status,
          requestedBy: reimbursementRequests.requestedBy,
          requestedAt: reimbursementRequests.requestedAt,
          approvedBy: reimbursementRequests.approvedBy,
          approvedAt: reimbursementRequests.approvedAt,
          approvalNote: reimbursementRequests.approvalNote,
          evidenceUrl: reimbursementRequests.evidenceUrl,
          confirmedAt: reimbursementRequests.confirmedAt,
          createdAt: reimbursementRequests.createdAt,
          updatedAt: reimbursementRequests.updatedAt
        })
        .from(reimbursementRequests)
        .where(eq(reimbursementRequests.id, id))
        .limit(1)
      request = requests[0]
    } catch (error: any) {
      // If careerYear column doesn't exist, select without it
      if (error?.code === '42703' && (error?.message?.includes('career_year') || error?.message?.includes('careerYear'))) {
        const requests = await db
          .select({
            id: reimbursementRequests.id,
            employeeId: reimbursementRequests.employeeId,
            year: reimbursementRequests.year,
            expenseAmount: reimbursementRequests.expenseAmount,
            reimbursementAmount: reimbursementRequests.reimbursementAmount,
            description: reimbursementRequests.description,
            category: reimbursementRequests.category,
            status: reimbursementRequests.status,
            requestedBy: reimbursementRequests.requestedBy,
            requestedAt: reimbursementRequests.requestedAt,
            approvedBy: reimbursementRequests.approvedBy,
            approvedAt: reimbursementRequests.approvedAt,
            approvalNote: reimbursementRequests.approvalNote,
            evidenceUrl: reimbursementRequests.evidenceUrl,
            confirmedAt: reimbursementRequests.confirmedAt,
            createdAt: reimbursementRequests.createdAt,
            updatedAt: reimbursementRequests.updatedAt
          })
          .from(reimbursementRequests)
          .where(eq(reimbursementRequests.id, id))
          .limit(1)
        request = requests[0]
      } else {
        throw error
      }
    }

    if (!request) {
      return res.status(404).json({ error: 'Request not found' })
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request is not pending' })
    }

    // Reject request
    let updated
    try {
      const result = await db
        .update(reimbursementRequests)
        .set({
          status: 'rejected',
          approvedBy: req.user.id,
          approvedAt: new Date(),
          approvalNote: note,
          updatedAt: new Date()
        })
        .where(eq(reimbursementRequests.id, id))
        .returning({
          id: reimbursementRequests.id,
          employeeId: reimbursementRequests.employeeId,
          year: reimbursementRequests.year,
          careerYear: reimbursementRequests.careerYear,
          expenseAmount: reimbursementRequests.expenseAmount,
          reimbursementAmount: reimbursementRequests.reimbursementAmount,
          description: reimbursementRequests.description,
          category: reimbursementRequests.category,
          status: reimbursementRequests.status,
          requestedBy: reimbursementRequests.requestedBy,
          requestedAt: reimbursementRequests.requestedAt,
          approvedBy: reimbursementRequests.approvedBy,
          approvedAt: reimbursementRequests.approvedAt,
          approvalNote: reimbursementRequests.approvalNote,
          evidenceUrl: reimbursementRequests.evidenceUrl,
          confirmedAt: reimbursementRequests.confirmedAt,
          createdAt: reimbursementRequests.createdAt,
          updatedAt: reimbursementRequests.updatedAt
        })
      updated = result[0]
    } catch (error: any) {
      // If careerYear column doesn't exist, use SQL raw
      if (error?.code === '42703' && (error?.message?.includes('career_year') || error?.message?.includes('careerYear'))) {
        const result = await pool.query(
          `UPDATE reimbursement_requests 
           SET status = 'rejected', approved_by = $1, approved_at = NOW(), approval_note = $2, updated_at = NOW()
           WHERE id = $3
           RETURNING id, employee_id, year, expense_amount, reimbursement_amount, description, category, status, requested_by, requested_at, approved_by, approved_at, approval_note, evidence_url, confirmed_at, created_at, updated_at`,
          [req.user.id, note, id]
        )
        updated = result.rows[0]
      } else {
        throw error
      }
    }

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

    // Get current request - select specific fields to avoid careerYear if column doesn't exist
    let request
    try {
      const requests = await db
        .select({
          request: {
            id: reimbursementRequests.id,
            employeeId: reimbursementRequests.employeeId,
            year: reimbursementRequests.year,
            careerYear: reimbursementRequests.careerYear,
            expenseAmount: reimbursementRequests.expenseAmount,
            reimbursementAmount: reimbursementRequests.reimbursementAmount,
            description: reimbursementRequests.description,
            category: reimbursementRequests.category,
            status: reimbursementRequests.status,
            requestedBy: reimbursementRequests.requestedBy,
            requestedAt: reimbursementRequests.requestedAt,
            approvedBy: reimbursementRequests.approvedBy,
            approvedAt: reimbursementRequests.approvedAt,
            approvalNote: reimbursementRequests.approvalNote,
            evidenceUrl: reimbursementRequests.evidenceUrl,
            confirmedAt: reimbursementRequests.confirmedAt,
            createdAt: reimbursementRequests.createdAt,
            updatedAt: reimbursementRequests.updatedAt
          },
          member: teamMembers
        })
        .from(reimbursementRequests)
        .innerJoin(teamMembers, eq(reimbursementRequests.employeeId, teamMembers.id))
        .where(eq(reimbursementRequests.id, id))
        .limit(1)
      request = requests[0]
    } catch (error: any) {
      // If careerYear column doesn't exist, select without it
      if (error?.code === '42703' && (error?.message?.includes('career_year') || error?.message?.includes('careerYear'))) {
        const requests = await db
          .select({
            request: {
              id: reimbursementRequests.id,
              employeeId: reimbursementRequests.employeeId,
              year: reimbursementRequests.year,
              expenseAmount: reimbursementRequests.expenseAmount,
              reimbursementAmount: reimbursementRequests.reimbursementAmount,
              description: reimbursementRequests.description,
              category: reimbursementRequests.category,
              status: reimbursementRequests.status,
              requestedBy: reimbursementRequests.requestedBy,
              requestedAt: reimbursementRequests.requestedAt,
              approvedBy: reimbursementRequests.approvedBy,
              approvedAt: reimbursementRequests.approvedAt,
              approvalNote: reimbursementRequests.approvalNote,
              evidenceUrl: reimbursementRequests.evidenceUrl,
              confirmedAt: reimbursementRequests.confirmedAt,
              createdAt: reimbursementRequests.createdAt,
              updatedAt: reimbursementRequests.updatedAt
            },
            member: teamMembers
          })
          .from(reimbursementRequests)
          .innerJoin(teamMembers, eq(reimbursementRequests.employeeId, teamMembers.id))
          .where(eq(reimbursementRequests.id, id))
          .limit(1)
        request = requests[0]
      } else {
        throw error
      }
    }

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
    let updated
    try {
      const result = await db
        .update(reimbursementRequests)
        .set({
          evidenceUrl,
          confirmedAt: new Date(),
          status: 'confirmed',
          updatedAt: new Date()
        })
        .where(eq(reimbursementRequests.id, id))
        .returning({
          id: reimbursementRequests.id,
          employeeId: reimbursementRequests.employeeId,
          year: reimbursementRequests.year,
          careerYear: reimbursementRequests.careerYear,
          expenseAmount: reimbursementRequests.expenseAmount,
          reimbursementAmount: reimbursementRequests.reimbursementAmount,
          description: reimbursementRequests.description,
          category: reimbursementRequests.category,
          status: reimbursementRequests.status,
          requestedBy: reimbursementRequests.requestedBy,
          requestedAt: reimbursementRequests.requestedAt,
          approvedBy: reimbursementRequests.approvedBy,
          approvedAt: reimbursementRequests.approvedAt,
          approvalNote: reimbursementRequests.approvalNote,
          evidenceUrl: reimbursementRequests.evidenceUrl,
          confirmedAt: reimbursementRequests.confirmedAt,
          createdAt: reimbursementRequests.createdAt,
          updatedAt: reimbursementRequests.updatedAt
        })
      updated = result[0]
    } catch (error: any) {
      // If careerYear column doesn't exist, use SQL raw
      if (error?.code === '42703' && (error?.message?.includes('career_year') || error?.message?.includes('careerYear'))) {
        const result = await pool.query(
          `UPDATE reimbursement_requests 
           SET evidence_url = $1, confirmed_at = NOW(), status = 'confirmed', updated_at = NOW()
           WHERE id = $2
           RETURNING id, employee_id, year, expense_amount, reimbursement_amount, description, category, status, requested_by, requested_at, approved_by, approved_at, approval_note, evidence_url, confirmed_at, created_at, updated_at`,
          [evidenceUrl, id]
        )
        updated = result.rows[0]
      } else {
        throw error
      }
    }

    res.json(updated)
  } catch (error) {
    console.error('Error uploading evidence:', error)
    res.status(500).json({ error: 'Failed to upload evidence' })
  }
})

export default router
