import express from 'express'
import { db, pool } from '../db/index.js'
import { reimbursementRequests, teamMembers, users, financialTransactions } from '../db/schema.js'
import { eq, and, or, sql, desc, like } from 'drizzle-orm'
import { calculateEmploymentMetrics } from '../utils/employment.js'
import { notifyReimbursementRequest } from '../utils/slack.js'
import { buildReimbursementRequestEmail, REQUEST_NOTIFICATION_EMAIL, sendEmail } from '../services/email.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { uploadsDirectory, resolveUploadPath } from '../utils/uploads.js'
import { requireAuth } from '../middleware/auth.js'
import { resolveEmployeeId } from '../services/access.js'
import { payrollLock } from '../services/payroll.js'
import { cents, money, validDate, positiveId, idempotencyKey, FinanceValidationError, financeError } from '../lib/money.js'
import { logFinanceActivity } from '../lib/financeAudit.js'

const router = express.Router()
router.use(requireAuth)

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = uploadsDirectory
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
    const extname = ['.jpeg','.jpg','.png','.pdf'].includes(path.extname(file.originalname).toLowerCase())
    const mimetype = ['image/jpeg','image/png','application/pdf'].includes(file.mimetype)

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

function notifyNewReimbursementRequest(options: {
  member: { name?: string | null; email?: string | null }
  requestId: number
  description: string
  category?: string | null
  expenseAmount: number | string
  reimbursementAmount: number | string
  year: number
}) {
  notifyReimbursementRequest({
    employeeName: options.member.name || null,
    employeeEmail: options.member.email || 'unknown',
    requestId: options.requestId,
    description: options.description,
    amount: String(options.reimbursementAmount)
  }).catch((err) => console.error('[SLACK] reimbursement notify failed:', err))

  sendEmail(buildReimbursementRequestEmail({
    to: REQUEST_NOTIFICATION_EMAIL,
    employeeName: options.member.name || null,
    employeeEmail: options.member.email || null,
    requestId: options.requestId,
    description: options.description,
    category: options.category || null,
    expenseAmount: options.expenseAmount,
    reimbursementAmount: options.reimbursementAmount,
    year: options.year,
  })).catch((err) => console.error('[email] reimbursement request notify failed:', err))
}

// GET /api/reimbursements/limits/:year - Get available limit for current employee
router.get('/limits/:year',async(req,res)=>{
  try{
    const id=await resolveEmployeeId(req.user);if(!id)throw new FinanceValidationError('Employee profile required',403)
    const [member]=await db.select().from(teamMembers).where(eq(teamMembers.id,id))
    const careerYear=calculateEmploymentMetrics(member.startDate).careerYear,limit=getYearlyLimit(careerYear)*100
    const rows=await db.select().from(reimbursementRequests).where(and(eq(reimbursementRequests.employeeId,id),eq(reimbursementRequests.careerYear,careerYear)))
    const reserved=rows.filter(r=>['pending','approved','confirmed'].includes(r.status)).reduce((s,r)=>s+cents(r.reimbursementAmount),0)
    const paid=rows.filter(r=>r.status==='paid').reduce((s,r)=>s+cents(r.reimbursementAmount),0)
    res.json({yearsAtCompany:careerYear,yearlyLimit:limit/100,usedAmount:(reserved+paid)/100,reservedAmount:reserved/100,paidAmount:paid/100,availableAmount:Math.max(limit-reserved-paid,0)/100,year:new Date().getFullYear()})
  }catch(error){financeError(res,error,'Failed to load reimbursement budget')}
})
router.get('/my-requests',async(req,res)=>{
  try{const id=await resolveEmployeeId(req.user);if(!id)throw new FinanceValidationError('Employee profile required',403);res.json(await db.select().from(reimbursementRequests).where(eq(reimbursementRequests.employeeId,id)).orderBy(desc(reimbursementRequests.requestedAt)))}catch(error){financeError(res,error,'Failed to load reimbursement requests')}
})

router.post('/', async(req,res)=>{
  try{
    const memberId=await resolveEmployeeId(req.user)
    if(!memberId)throw new FinanceValidationError('Employee profile required',403)
    const expense=cents(req.body.expenseAmount,'Expense amount',false),key=idempotencyKey(req.body.idempotencyKey)
    const description=typeof req.body.description==='string'?req.body.description.trim():''
    if(!description)throw new FinanceValidationError('Description is required')
    const result=await db.transaction(async(tx)=>{
      await payrollLock(tx,memberId)
      const [old]=await tx.select().from(reimbursementRequests).where(eq(reimbursementRequests.idempotencyKey,key))
      if(old){if(old.employeeId!==memberId||cents(old.expenseAmount)!==expense||old.description!==description)throw new FinanceValidationError('Idempotency key was already used',409);return {request:old,duplicate:true}}
      const [member]=await tx.select().from(teamMembers).where(eq(teamMembers.id,memberId))
      const careerYear=calculateEmploymentMetrics(member.startDate).careerYear
      const requests=await tx.select().from(reimbursementRequests).where(and(eq(reimbursementRequests.employeeId,memberId),eq(reimbursementRequests.careerYear,careerYear)))
      const used=requests.filter(r=>['pending','approved','confirmed','paid'].includes(r.status)).reduce((sum,r)=>sum+cents(r.reimbursementAmount),0)
      const reimbursed=Math.min(Math.round(expense/2),getYearlyLimit(careerYear)*100-used)
      if(reimbursed<=0)throw new FinanceValidationError('No reimbursement budget is available',409)
      const [request]=await tx.insert(reimbursementRequests).values({employeeId:memberId,year:new Date().getFullYear(),careerYear,expenseAmount:money(expense),reimbursementAmount:money(reimbursed),description,category:req.body.category || null,status:'pending',requestedBy:req.user!.id,idempotencyKey:key}).returning()
      return {request,member,duplicate:false}
    })
    if(!result.duplicate)notifyNewReimbursementRequest({member:result.member!,requestId:result.request.id,description:result.request.description,category:result.request.category,expenseAmount:result.request.expenseAmount,reimbursementAmount:result.request.reimbursementAmount,year:result.request.year})
    res.status(result.duplicate?200:201).json(result.request)
  }catch(error){financeError(res,error,'Failed to create reimbursement request')}
})

router.get('/evidence/:filename',async(req,res)=>{
  try{
    const filename=req.params.filename
    if(!/^evidence-[A-Za-z0-9-]+\.(png|jpe?g|pdf)$/.test(filename))throw new FinanceValidationError('Invalid evidence filename')
    const url=`/uploads/${filename}`
    const [request]=await db.select({employeeId:reimbursementRequests.employeeId}).from(reimbursementRequests).where(eq(reimbursementRequests.evidenceUrl,url)).limit(1)
    if(!request)throw new FinanceValidationError('Evidence not found',404)
    if(req.user!.role!=='admin'&&request.employeeId!==await resolveEmployeeId(req.user))throw new FinanceValidationError('Access denied',403)
    res.setHeader('Cache-Control','private, no-store')
    res.setHeader('X-Content-Type-Options','nosniff')
    res.sendFile(resolveUploadPath(url),error=>{if(error&&!res.headersSent)res.status(404).json({error:'Evidence file not found'})})
  }catch(error){financeError(res,error,'Failed to load evidence')}
})

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
        confirmedAt: reimbursementRequests.confirmedAt,
        paidAt: reimbursementRequests.paidAt,
        paymentTransactionId: reimbursementRequests.paymentTransactionId
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
async function reviewRequest(req:any,res:any,approved:boolean){
  try{
    if(req.user?.role!=='admin')throw new FinanceValidationError('Admin access required',403)
    const id=positiveId(req.params.id),note=typeof req.body.note==='string'?req.body.note.trim():''
    if(!approved&&!note)throw new FinanceValidationError('Rejection reason is required')
    const result=await db.transaction(async(tx)=>{
      const [request]=await tx.select().from(reimbursementRequests).where(eq(reimbursementRequests.id,id))
      if(!request)throw new FinanceValidationError('Request not found',404)
      await payrollLock(tx,request.employeeId)
      const [updated]=await tx.update(reimbursementRequests).set({status:approved?'approved':'rejected',approvedBy:req.user.id,approvedAt:new Date(),approvalNote:note || null,updatedAt:new Date()}).where(and(eq(reimbursementRequests.id,id),eq(reimbursementRequests.status,'pending'))).returning()
      if(!updated)throw new FinanceValidationError('Request was already reviewed. Refresh its status.',409)
      return updated
    });res.json(result)
  }catch(error){financeError(res,error,'Failed to review reimbursement request')}
}
router.put('/:id/approve',(req,res)=>reviewRequest(req,res,true))
router.put('/:id/reject',(req,res)=>reviewRequest(req,res,false))
router.post('/:id/pay',async(req,res)=>{
  try{
    if(req.user!.role!=='admin')throw new FinanceValidationError('Admin access required',403)
    const id=positiveId(req.params.id),date=validDate(req.body.transactionDate,'Payment date'),key=idempotencyKey(req.body.idempotencyKey)
    const result=await db.transaction(async(tx)=>{
      const [initial]=await tx.select().from(reimbursementRequests).where(eq(reimbursementRequests.id,id))
      if(!initial)throw new FinanceValidationError('Request not found',404)
      await payrollLock(tx,initial.employeeId)
      const [request]=await tx.select().from(reimbursementRequests).where(eq(reimbursementRequests.id,id)).for('update')
      if(request.paymentTransactionId){const [payment]=await tx.select().from(financialTransactions).where(eq(financialTransactions.id,request.paymentTransactionId));if(payment.idempotencyKey===key&&payment.transactionDate===date)return request;throw new FinanceValidationError('This reimbursement has already been paid',409)}
      if(request.status!=='confirmed')throw new FinanceValidationError('Receipt must be confirmed before recording payment',409)
      const [existingKey]=await tx.select({id:financialTransactions.id}).from(financialTransactions).where(eq(financialTransactions.idempotencyKey,key))
      if(existingKey)throw new FinanceValidationError('Idempotency key was already used',409)
      const [payment]=await tx.insert(financialTransactions).values({type:'expense',category:'workspace_reimbursement',amount:request.reimbursementAmount,description:`Reimbursement #${id}: ${request.description}`,transactionDate:date,teamMemberId:request.employeeId,createdBy:req.user!.id,idempotencyKey:key}).returning()
      const [updated]=await tx.update(reimbursementRequests).set({status:'paid',paymentTransactionId:payment.id,paidAt:new Date(`${date}T12:00:00Z`),updatedAt:new Date()}).where(eq(reimbursementRequests.id,id)).returning()
      await logFinanceActivity(tx,{action:'reimbursement_paid',entityType:'transaction',entityId:payment.id,transactionId:payment.id,teamMemberId:request.employeeId,actorId:req.user!.id,summary:`Recorded reimbursement #${id} payment`,afterData:{amount:payment.amount,requestId:id,transactionDate:date}})
      return updated
    });res.json(result)
  }catch(error){financeError(res,error,'Failed to record reimbursement payment')}
})

router.post('/:id/upload',async(req,res,next)=>{
  try{const employeeId=await resolveEmployeeId(req.user);const [request]=await db.select().from(reimbursementRequests).where(eq(reimbursementRequests.id,positiveId(req.params.id)));if(!request)throw new FinanceValidationError('Request not found',404);if(request.employeeId!==employeeId)throw new FinanceValidationError('Access denied',403);if(request.status!=='approved')throw new FinanceValidationError('Request must be approved before uploading evidence',409);next()}catch(error){financeError(res,error,'Cannot upload evidence')}
},upload.single('evidence'),async(req,res)=>{
  try{
    if(!req.file)throw new FinanceValidationError('Evidence file is required')
    const [updated]=await db.update(reimbursementRequests).set({evidenceUrl:`/uploads/${req.file.filename}`,confirmedAt:new Date(),status:'confirmed',updatedAt:new Date()}).where(and(eq(reimbursementRequests.id,positiveId(req.params.id)),eq(reimbursementRequests.status,'approved'))).returning()
    if(!updated)throw new FinanceValidationError('Request status changed. Reload before uploading evidence.',409)
    res.json(updated)
  }catch(error){if(req.file)fs.unlink(req.file.path,()=>{});financeError(res,error,'Failed to upload evidence')}
})

router.use((error:any,_req:any,res:any,_next:any)=>{if(error instanceof multer.MulterError || error.message?.includes('format allowed'))return res.status(error.code==='LIMIT_FILE_SIZE'?413:400).json({error:error.code==='LIMIT_FILE_SIZE'?'Receipt must not exceed 5 MB':error.message});financeError(res,error,'Reimbursement operation failed')})

export default router
