import { Router } from 'express'
import { and, eq, desc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { freelancerFees, teamMembers, clientServices, clientServiceTeamMembers, clients, serviceTypes, financialTransactions } from '../db/schema.js'
import { requireAdmin } from '../middleware/auth.js'
import { cents, money, validDate, positiveId, idempotencyKey, FinanceValidationError, financeError } from '../lib/money.js'
import { payrollLock } from '../services/payroll.js'
import { getWorkflowAccess, requireWorkflowCapability } from '../services/workflow.js'
import { logFinanceActivity } from '../lib/financeAudit.js'

const router = Router()
router.use(requireAdmin)
router.get('/:memberId', async (req,res) => {
  try {
    const memberId=positiveId(req.params.memberId)
    const [fees,projects,access]=await Promise.all([
      db.select({fee:freelancerFees,projectName:clientServices.serviceTitle,serviceName:serviceTypes.name,clientName:clients.name,paymentDate:financialTransactions.transactionDate})
        .from(freelancerFees).innerJoin(clientServices,eq(clientServices.id,freelancerFees.clientServiceId)).innerJoin(serviceTypes,eq(serviceTypes.id,clientServices.serviceTypeId)).innerJoin(clients,eq(clients.id,clientServices.clientId)).leftJoin(financialTransactions,eq(financialTransactions.id,freelancerFees.paymentTransactionId)).where(eq(freelancerFees.teamMemberId,memberId)).orderBy(desc(freelancerFees.accruedDate),desc(freelancerFees.id)),
      db.select({id:clientServices.id,name:clientServices.serviceTitle,serviceName:serviceTypes.name,clientName:clients.name}).from(clientServiceTeamMembers).innerJoin(clientServices,eq(clientServices.id,clientServiceTeamMembers.clientServiceId)).innerJoin(serviceTypes,eq(serviceTypes.id,clientServices.serviceTypeId)).innerJoin(clients,eq(clients.id,clientServices.clientId)).where(and(eq(clientServiceTeamMembers.teamMemberId,memberId),eq(clientServiceTeamMembers.isActive,true),eq(clientServices.isActive,true))),
      getWorkflowAccess(req.user),
    ])
    res.json({fees,projects:[...new Map(projects.map(p=>[p.id,p])).values()],canRecordPayment:access.canRecordPayment,currency:'USD'})
  } catch(error) {financeError(res,error,'Failed to load project fees')}
})
router.post('/:memberId',async(req,res)=>{
  try {
    const memberId=positiveId(req.params.memberId),projectId=positiveId(req.body.clientServiceId,'Project'),amount=money(cents(req.body.amount,'Project fee',false)),date=validDate(req.body.accruedDate),key=idempotencyKey(req.body.idempotencyKey)
    const description=typeof req.body.description==='string'?req.body.description.trim():''
    if(!description||description.length>2000)throw new FinanceValidationError('Describe the work (1–2000 characters)')
    const result=await db.transaction(async tx=>{
      await payrollLock(tx,memberId)
      const [old]=await tx.select().from(freelancerFees).where(eq(freelancerFees.idempotencyKey,key))
      if(old){if(old.teamMemberId!==memberId||old.clientServiceId!==projectId||old.amount!==amount||old.accruedDate!==date||old.description!==description)throw new FinanceValidationError('Idempotency key already used for another fee',409);return {fee:old,duplicate:true}}
      const [member]=await tx.select().from(teamMembers).where(eq(teamMembers.id,memberId))
      if(!member||member.employmentType!=='freelancer')throw new FinanceValidationError('Project fees require a freelancer profile',409)
      if(date<member.startDate)throw new FinanceValidationError('Accrual cannot predate the freelancer start date')
      const [assignment]=await tx.select({id:clientServiceTeamMembers.id}).from(clientServiceTeamMembers).innerJoin(clientServices,eq(clientServices.id,clientServiceTeamMembers.clientServiceId)).where(and(eq(clientServiceTeamMembers.teamMemberId,memberId),eq(clientServiceTeamMembers.clientServiceId,projectId),eq(clientServiceTeamMembers.isActive,true),eq(clientServices.isActive,true)))
      if(!assignment)throw new FinanceValidationError('Assign this freelancer to the project in Clients first',409)
      const [fee]=await tx.insert(freelancerFees).values({teamMemberId:memberId,clientServiceId:projectId,amount,description,accruedDate:date,idempotencyKey:key,createdBy:req.user!.id}).returning()
      await logFinanceActivity(tx,{action:'freelancer_fee_accrued',entityType:'freelancer_fee',entityId:fee.id,teamMemberId:memberId,actorId:req.user!.id,summary:`Accrued project fee: ${description}`,afterData:fee})
      return {fee,duplicate:false}
    })
    res.status(result.duplicate?200:201).json(result.fee)
  }catch(error){financeError(res,error,'Failed to accrue project fee')}
})
router.post('/:memberId/:feeId/pay',async(req,res)=>{
  try{
    await requireWorkflowCapability(req.user!,'canRecordPayment')
    const memberId=positiveId(req.params.memberId),feeId=positiveId(req.params.feeId),date=validDate(req.body.transactionDate,'Payment date'),key=idempotencyKey(req.body.idempotencyKey)
    const fee=await db.transaction(async tx=>{
      await payrollLock(tx,memberId)
      const [fee]=await tx.select().from(freelancerFees).where(and(eq(freelancerFees.id,feeId),eq(freelancerFees.teamMemberId,memberId))).for('update')
      if(!fee)throw new FinanceValidationError('Project fee not found',404)
      if(fee.paymentTransactionId){const [payment]=await tx.select().from(financialTransactions).where(eq(financialTransactions.id,fee.paymentTransactionId));if(payment.idempotencyKey===key&&payment.transactionDate===date)return fee;throw new FinanceValidationError('This fee is already paid',409)}
      if(fee.status!=='accrued')throw new FinanceValidationError('Only an outstanding fee can be paid',409)
      if(date<fee.accruedDate)throw new FinanceValidationError('Payment date cannot predate accrual')
      const [usedKey]=await tx.select({id:financialTransactions.id}).from(financialTransactions).where(eq(financialTransactions.idempotencyKey,key))
      if(usedKey)throw new FinanceValidationError('Payment key already used',409)
      const [project]=await tx.select().from(clientServices).where(eq(clientServices.id,fee.clientServiceId))
      const [payment]=await tx.insert(financialTransactions).values({type:'expense',category:'freelancer_project_fee',teamMemberId:memberId,clientId:project.clientId,amount:fee.amount,description:`Project fee #${fee.id}: ${fee.description}`,transactionDate:date,createdBy:req.user!.id,idempotencyKey:key}).returning()
      const [updated]=await tx.update(freelancerFees).set({status:'paid',paymentTransactionId:payment.id,updatedAt:new Date()}).where(eq(freelancerFees.id,feeId)).returning()
      await logFinanceActivity(tx,{action:'freelancer_fee_paid',entityType:'freelancer_fee',entityId:feeId,teamMemberId:memberId,transactionId:payment.id,actorId:req.user!.id,summary:`Recorded project fee payment: ${fee.description}`,beforeData:fee,afterData:updated})
      return updated
    });res.json(fee)
  }catch(error){financeError(res,error,'Failed to record project fee payment')}
})
router.post('/:memberId/:feeId/cancel',async(req,res)=>{
  try{
    const memberId=positiveId(req.params.memberId),feeId=positiveId(req.params.feeId)
    const fee=await db.transaction(async tx=>{
      await payrollLock(tx,memberId)
      const [fee]=await tx.select().from(freelancerFees).where(and(eq(freelancerFees.id,feeId),eq(freelancerFees.teamMemberId,memberId))).for('update')
      if(!fee)throw new FinanceValidationError('Project fee not found',404)
      if(fee.status!=='accrued')throw new FinanceValidationError('Only an unpaid accrual can be cancelled',409)
      const [updated]=await tx.update(freelancerFees).set({status:'cancelled',updatedAt:new Date()}).where(eq(freelancerFees.id,feeId)).returning()
      await logFinanceActivity(tx,{action:'freelancer_fee_cancelled',entityType:'freelancer_fee',entityId:feeId,teamMemberId:memberId,actorId:req.user!.id,summary:`Cancelled unpaid project fee: ${fee.description}`,beforeData:fee,afterData:updated})
      return updated
    });res.json(fee)
  }catch(error){financeError(res,error,'Failed to cancel project fee')}
})
export default router
