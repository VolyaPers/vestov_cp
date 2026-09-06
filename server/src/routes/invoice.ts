import { Router } from 'express'
import { eq, desc, and, sql, ne, inArray } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  invoices,
  clients,
  clientServices,
  serviceTypes,
  clientServiceTeamMembers,
  teamMembers,
  invoiceServices,
  invoiceDevelopers
} from '../db/schema.js'
import {
  diffRecord,
  logFinanceActivity,
  pickInvoiceSnapshot,
} from '../lib/financeAudit.js'
import { requireAuth } from '../middleware/auth.js'
import { canAccessClient, accessibleClientIds } from '../services/access.js'
import { calculateInvoice } from '../services/invoiceCalculator.js'
import { cents, money, positiveId, validDate, FinanceValidationError, financeError } from '../lib/money.js'

const router = Router()

router.use(requireAuth)
const issuedStatuses=['sent','overdue','paid']
async function allowClient(req:any, clientId:number) {if(!['admin','client'].includes(req.user?.role)||!await canAccessClient(req.user,clientId)) throw new FinanceValidationError('Access denied',403)}
function invoiceStatus(status:string, paidAt:any, dueDate:any){ if(status==='paid'&&paidAt) return 'paid'; if(['sent','overdue'].includes(status)&&dueDate) return dueDate<new Date().toISOString().slice(0,10)?'overdue':'sent'; return status }
function financialState(input:any, prior?:any) {
  const status=input.status ?? prior?.status ?? 'draft'
  if(!['draft','sent','paid','overdue','cancelled'].includes(status)) throw new FinanceValidationError('Invalid invoice status')
  const paidAt=input.paidAt!==undefined ? input.paidAt : prior?.paidAt
  if(status==='paid'&&!paidAt) throw new FinanceValidationError('A payment date is required to mark an invoice paid')
  if(paidAt && status!=='paid') throw new FinanceValidationError('Clear the payment date before changing a paid invoice status')
  if(paidAt&&typeof paidAt!=='string'&&!(paidAt instanceof Date))throw new FinanceValidationError('Invalid payment date')
  if(paidAt)validDate(typeof paidAt==='string'?paidAt.slice(0,10):paidAt.toISOString().slice(0,10),'Payment date')
  if(paidAt&&!Number.isFinite(new Date(paidAt).getTime())) throw new FinanceValidationError('Invalid payment date')
  return {status,paidAt:paidAt?new Date(paidAt):null}
}
async function totalsForClient(clientId:number, admin:boolean){
  const rows=await db.select().from(invoices).where(and(eq(invoices.clientId,clientId),admin?undefined:inArray(invoices.status,issuedStatuses)))
  const totals={totalInvoiced:0,totalPaid:0,pendingAmount:0,overdueAmount:0}
  for(const row of rows){if(row.status==='cancelled')continue; const amount=cents(row.amount); totals.totalInvoiced+=amount; if(row.status==='paid'&&row.paidAt)totals.totalPaid+=amount;else if(row.status!=='draft'){totals.pendingAmount+=amount;if(invoiceStatus(row.status,row.paidAt,row.dueDate)==='overdue')totals.overdueAmount+=amount}}
  return Object.fromEntries(Object.entries(totals).map(([key,value])=>[key,Number(money(value))]))
}
async function persistLines(tx:any,invoiceId:number,calculation:any){
  for(const service of calculation.services){
    const [row]=await tx.insert(invoiceServices).values({invoiceId,clientServiceId:service.serviceId,serviceLevelPrice:service.serviceLevelPrice===undefined?null:String(service.serviceLevelPrice),calculatedAmount:money(cents(service.finalAmount))}).returning()
    for(const dev of service.developers)await tx.insert(invoiceDevelopers).values({invoiceServiceId:row.id,clientServiceTeamMemberId:dev.id,hourlyRate:dev.hourlyRate,fixedPrice:dev.fixedPrice,hoursWorked:dev.hoursWorked,calculatedAmount:money(cents(dev.amount))})
  }
}

// Get all invoices (admin only)
router.get('/', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Get optional date range filters from query parameters
    const { startDate, endDate } = req.query

    // Build where conditions
    const whereConditions = []

    if (startDate && typeof startDate === 'string') {
      whereConditions.push(sql`${invoices.invoiceDate} >= ${startDate}`)
    }

    if (endDate && typeof endDate === 'string') {
      whereConditions.push(sql`${invoices.invoiceDate} <= ${endDate}`)
    }

    const allInvoices = await db
      .select({
        id: invoices.id,
        clientId: invoices.clientId,
        clientName: clients.name,
        clientLogoUrl: clients.logoUrl,
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
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(invoices.createdAt))

    res.json(allInvoices.map(row=>({...row,amount:Number(row.amount),status:invoiceStatus(row.status,row.paidAt,row.dueDate)})))
  } catch (error) {
    console.error('Get invoices error:', error)
    financeError(res,error,'Failed to fetch invoices')
  }
})

// Get invoices for a specific client
router.get('/client/:clientId', async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId)

    // Check if user has access to this client's data
    await allowClient(req,clientId)

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
      .where(and(eq(invoices.clientId, clientId),req.user!.role==='admin'?undefined:inArray(invoices.status,issuedStatuses)))
      .orderBy(desc(invoices.createdAt))

    res.json(clientInvoices.map(row=>({...row,amount:Number(row.amount),status:invoiceStatus(row.status,row.paidAt,row.dueDate)})))
  } catch (error) {
    console.error('Get client invoices error:', error)
    financeError(res,error,'Failed to fetch client invoices')
  }
})

router.get('/totals',async(req,res)=>{
  try{ if(!['admin','client'].includes(req.user!.role))throw new FinanceValidationError('Access denied',403);const requested=typeof req.query.clientIds==='string'?req.query.clientIds.split(',').map(id=>positiveId(id)):await accessibleClientIds(req.user);for(const id of requested)await allowClient(req,id);res.json(await Promise.all(requested.map(async id=>({clientId:id,...await totalsForClient(id,req.user!.role==='admin')}))))}catch(error){financeError(res,error,'Failed to fetch invoice totals')}
})

// Get a specific invoice
router.get('/:id', async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.id)

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
      .where(eq(invoices.id, invoiceId))

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' })
    }

    // Check if user has access to this invoice
    await allowClient(req,invoice.clientId)
    if(req.user!.role!=='admin'&&!issuedStatuses.includes(invoice.status)) throw new FinanceValidationError('Invoice not found',404)

    const services = await db
      .select({
        id: invoiceServices.id,
        serviceId: invoiceServices.clientServiceId,
        serviceName: serviceTypes.name,
        serviceTitle: clientServices.serviceTitle,
        serviceCategory: serviceTypes.category,
        billingModel: serviceTypes.billingModel,
        serviceLevelPrice: invoiceServices.serviceLevelPrice,
        calculatedAmount: invoiceServices.calculatedAmount,
      })
      .from(invoiceServices)
      .leftJoin(clientServices, eq(invoiceServices.clientServiceId, clientServices.id))
      .leftJoin(serviceTypes, eq(clientServices.serviceTypeId, serviceTypes.id))
      .where(eq(invoiceServices.invoiceId, invoiceId))

    const detailedServices = await Promise.all(services.map(async service => ({
      ...service,
      serviceName: service.serviceTitle || service.serviceName,
      serviceTypeName: service.serviceName,
      developers: await db.select({id: invoiceDevelopers.id, developerId: invoiceDevelopers.clientServiceTeamMemberId, developerName: teamMembers.name, hourlyRate: invoiceDevelopers.hourlyRate, fixedPrice: invoiceDevelopers.fixedPrice, hoursWorked: invoiceDevelopers.hoursWorked, calculatedAmount: invoiceDevelopers.calculatedAmount}).from(invoiceDevelopers).leftJoin(clientServiceTeamMembers, eq(invoiceDevelopers.clientServiceTeamMemberId, clientServiceTeamMembers.id)).leftJoin(teamMembers, eq(clientServiceTeamMembers.teamMemberId, teamMembers.id)).where(eq(invoiceDevelopers.invoiceServiceId, service.id)),
    })))
    res.json({
      ...invoice,
      amount:Number(invoice.amount),
      status:invoiceStatus(invoice.status,invoice.paidAt,invoice.dueDate),
      ...(req.user!.role==='admin'?{}:{createdBy:undefined}),
      serviceIds: services.map((service) => service.serviceId),
      services: detailedServices,
    })
  } catch (error) {
    console.error('Get invoice error:', error)
    financeError(res,error,'Failed to fetch invoice')
  }
})

// Create a new invoice (admin only)
router.post('/', async (req, res) => {
  try {
    // Only admins can create invoices
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' })
    }

    const {
      clientId,
      amount,
      invoiceDate,
      periodStart,
      periodEnd,
      description,
      dueDate,
      notes,
      serviceIds,
      useServicePricing,
      developerRates,
      servicePrices = {},
      paidAt,
      status
    } = req.body

    positiveId(clientId,'Client ID')
    if(useServicePricing!==undefined&&typeof useServicePricing!=='boolean')throw new FinanceValidationError('useServicePricing must be boolean')
    if (!clientId || (!useServicePricing && amount === undefined)) {
      return res.status(400).json({ error: 'Client ID and amount are required' })
    }

    // Default values
    const today = new Date().toISOString().split('T')[0]
    const lastMonth = new Date()
    lastMonth.setMonth(lastMonth.getMonth() - 1)
    const lastMonthStart = new Date(Date.UTC(lastMonth.getFullYear(), lastMonth.getMonth(), 1)).toISOString().split('T')[0]
    const lastMonthEnd = new Date(Date.UTC(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0)).toISOString().split('T')[0]

    const selectedDate=validDate(invoiceDate || today,'Invoice date')
    const selectedStart=validDate(periodStart || lastMonthStart,'Period start'), selectedEnd=validDate(periodEnd || lastMonthEnd,'Period end')
    if(selectedStart>selectedEnd)throw new FinanceValidationError('Invalid invoice period')
    if(dueDate)validDate(dueDate,'Due date')
    const state=financialState({...req.body,status:paidAt?'paid':status})
    const createdInvoice = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(71421, 1)`)
      const [client]=await tx.select({id:clients.id}).from(clients).where(eq(clients.id,positiveId(clientId)))
      if(!client)throw new FinanceValidationError('Client not found',404)
      const year=new Date().getFullYear()
      const [latest]=await tx.select({invoiceNumber:invoices.invoiceNumber}).from(invoices).where(sql`${invoices.invoiceNumber} LIKE ${`INV-${year}-%`}`).orderBy(desc(invoices.id)).limit(1)
      const next=latest?Number(latest.invoiceNumber.split('-')[2])+1:1
      const invoiceNumber=`INV-${year}-${String(next).padStart(4,'0')}`
      const calculation=useServicePricing?await calculateInvoice(tx,positiveId(clientId),{...req.body,periodStart:selectedStart,periodEnd:selectedEnd}):null
      const total=calculation?cents(calculation.totalAmount):cents(amount,'Invoice amount',false)
      if(total===0)throw new FinanceValidationError('Invoice total must be greater than zero')
      const [newInvoice] = await tx.insert(invoices).values({
        clientId: parseInt(clientId),
        invoiceNumber,
        amount: money(total),
        invoiceDate: selectedDate,
        periodStart: selectedStart,
        periodEnd: selectedEnd,
        description: description || null,
        dueDate: dueDate || null,
        notes: notes || null,
        status: state.status,
        paidAt: state.paidAt,
        createdBy: req.user!.id,
      }).returning()

      if(calculation) await persistLines(tx,newInvoice.id,calculation)

      await logFinanceActivity(tx, {
        action: 'invoice_created',
        entityType: 'invoice',
        entityId: newInvoice.id,
        invoiceId: newInvoice.id,
        clientId: newInvoice.clientId,
        actorId: req.user!.id,
        summary: `Created invoice ${newInvoice.invoiceNumber}`,
        afterData: pickInvoiceSnapshot(newInvoice),
        metadata: {
          useServicePricing: Boolean(useServicePricing),
          serviceIds: serviceIds || [],
        },
      })

      return newInvoice
    })

    res.json(createdInvoice)
  } catch (error) {
    console.error('Create invoice error:', error)
    financeError(res,error,'Failed to create invoice')
  }
})

// Financial state and its persisted breakdown are changed under the same invoice lock.
router.put('/:id', async (req, res) => {
  try {
    if (req.user!.role !== 'admin') throw new FinanceValidationError('Access denied', 403)
    const invoiceId = positiveId(req.params.id), input = req.body
    if(input.useServicePricing!==undefined&&typeof input.useServicePricing!=='boolean')throw new FinanceValidationError('useServicePricing must be boolean')
    const result = await db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(71422, ${invoiceId})`)
      const [prior] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId)).for('update')
      if (!prior) throw new FinanceValidationError('Invoice not found', 404)
      const update: any = { ...financialState(input, prior), updatedAt: new Date() }
      for (const field of ['description', 'notes']) if (input[field] !== undefined) update[field] = input[field] || null
      for (const field of ['invoiceDate', 'periodStart', 'periodEnd']) if (input[field] !== undefined) update[field] = validDate(input[field], field)
      if (input.dueDate !== undefined) update.dueDate = input.dueDate ? validDate(input.dueDate, 'Due date') : null
      const periodStart = update.periodStart || prior.periodStart, periodEnd = update.periodEnd || prior.periodEnd
      if (periodStart > periodEnd) throw new FinanceValidationError('Invalid invoice period')
      const oldLines = await tx.select({id:invoiceServices.id}).from(invoiceServices).where(eq(invoiceServices.invoiceId, invoiceId))
      const amountChanged = input.amount !== undefined && cents(input.amount, 'Invoice amount', false) !== cents(prior.amount)
      if (prior.status === 'paid' && (input.useServicePricing !== undefined || amountChanged)) throw new FinanceValidationError('Reopen the paid invoice before changing its amount or lines', 409)
      if (oldLines.length && input.useServicePricing === undefined && amountChanged) throw new FinanceValidationError('Change the service prices to update an invoice with a saved breakdown')
      if (input.serviceIds !== undefined && input.useServicePricing === undefined) throw new FinanceValidationError('Service changes require a pricing calculation')
      if (input.amount !== undefined) update.amount = money(cents(input.amount, 'Invoice amount', false))
      const calculation = input.useServicePricing === true ? await calculateInvoice(tx, prior.clientId, {...input, periodStart, periodEnd}) : null
      if (calculation) update.amount = money(cents(calculation.totalAmount, 'Invoice total', false))
      if (calculation || input.useServicePricing === false) {
        for (const line of oldLines) await tx.delete(invoiceDevelopers).where(eq(invoiceDevelopers.invoiceServiceId, line.id))
        await tx.delete(invoiceServices).where(eq(invoiceServices.invoiceId, invoiceId))
        if (calculation) await persistLines(tx, invoiceId, calculation)
      }
      const [row] = await tx.update(invoices).set(update).where(eq(invoices.id, invoiceId)).returning()
      await logFinanceActivity(tx, {action:'invoice_updated',entityType:'invoice',entityId:row.id,invoiceId:row.id,clientId:row.clientId,actorId:req.user!.id,summary:`Updated invoice ${row.invoiceNumber}`,beforeData:pickInvoiceSnapshot(prior),afterData:pickInvoiceSnapshot(row),metadata:{changes:diffRecord(pickInvoiceSnapshot(prior),pickInvoiceSnapshot(row)),useServicePricing:input.useServicePricing,serviceIds:input.serviceIds}})
      return row
    })
    res.json(result)
  } catch(error) { financeError(res,error,'Failed to update invoice') }
})

// Cancellation preserves invoice numbering, line items, and the financial audit trail.
router.delete('/:id', async (req, res) => {
  try {
    if (req.user!.role !== 'admin') throw new FinanceValidationError('Access denied', 403)
    const invoiceId = positiveId(req.params.id)
    const result = await db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(71422, ${invoiceId})`)
      const [prior] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId)).for('update')
      if (!prior) throw new FinanceValidationError('Invoice not found', 404)
      if (prior.paidAt || prior.status === 'paid') throw new FinanceValidationError('Reopen the paid invoice and clear its payment date before cancelling', 409)
      if (prior.status === 'cancelled') return prior
      const [row] = await tx.update(invoices).set({status:'cancelled',updatedAt:new Date()}).where(eq(invoices.id, invoiceId)).returning()
      await logFinanceActivity(tx,{action:'invoice_cancelled',entityType:'invoice',entityId:row.id,invoiceId:row.id,clientId:row.clientId,actorId:req.user!.id,summary:`Cancelled invoice ${row.invoiceNumber}`,beforeData:pickInvoiceSnapshot(prior),afterData:pickInvoiceSnapshot(row)})
      return row
    })
    res.json({message:'Invoice cancelled',invoice:result})
  } catch(error) { financeError(res,error,'Failed to cancel invoice') }
})

// Get client service options for invoice creation
router.get('/client-service-options/:clientId', async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId)

    // Check if user has access to this client's data
    await allowClient(req,clientId)

    if(req.user!.role!=='admin') throw new FinanceValidationError('Admin access required',403)

    // Get client's active services with their developers
    const clientServicesWithDevelopers = await db
      .select({
        id: clientServices.id,
        serviceId: clientServices.serviceTypeId,
        serviceName: serviceTypes.name,
        serviceTitle: clientServices.serviceTitle,
        serviceCategory: serviceTypes.category,
        billingModel: serviceTypes.billingModel,
        serviceLevelPrice: clientServices.serviceLevelPrice,
        isActive: clientServices.isActive,
      })
      .from(clientServices)
      .leftJoin(serviceTypes, eq(clientServices.serviceTypeId, serviceTypes.id))
      .where(and(eq(clientServices.clientId, clientId), eq(clientServices.isActive, true)))

    // For each service, get its assigned developers
    const servicesWithDetails = await Promise.all(
      clientServicesWithDevelopers.map(async (service) => {
        const assignedDevelopers = await db
          .select({
            id: clientServiceTeamMembers.id,
            teamMemberId: clientServiceTeamMembers.teamMemberId,
            developerName: teamMembers.name,
            developerAvatarUrl: teamMembers.avatarUrl,
            hourlyRate: clientServiceTeamMembers.hourlyRate,
            fixedPrice: clientServiceTeamMembers.fixedPrice,
            employmentType: clientServiceTeamMembers.employmentType,
            isActive: clientServiceTeamMembers.isActive,
          })
          .from(clientServiceTeamMembers)
          .leftJoin(teamMembers, eq(clientServiceTeamMembers.teamMemberId, teamMembers.id))
          .where(and(
            eq(clientServiceTeamMembers.clientServiceId, service.id),
            eq(clientServiceTeamMembers.isActive, true)
          ))

        return {
          ...service,
          developers: assignedDevelopers
        }
      })
    )

    // Also get all available services that aren't assigned to this client yet
    const assignedServiceIds = clientServicesWithDevelopers.map(s => s.serviceId)
    const availableServices = await db
      .select({
        id: serviceTypes.id,
        name: serviceTypes.name,
        category: serviceTypes.category,
        billingModel: serviceTypes.billingModel,
      })
      .from(serviceTypes)
      .where(assignedServiceIds.length > 0 ?
        and(...assignedServiceIds.map(id => ne(serviceTypes.id, id))) :
        undefined
      )

    res.json({
      clientServices: servicesWithDetails,
      availableServices
    })
  } catch (error) {
    console.error('Get client service options error:', error)
    financeError(res,error,'Failed to fetch service options')
  }
})

// Calculate pricing for services
router.post('/calculate-pricing/:clientId',async(req,res)=>{
  try{if(req.user!.role!=='admin')throw new FinanceValidationError('Admin access required',403);res.json(await calculateInvoice(db,positiveId(req.params.clientId),req.body))}catch(error){financeError(res,error,'Failed to calculate invoice')}
})

// Get client invoice totals
router.get('/client/:clientId/totals',async(req,res)=>{
  try{const id=positiveId(req.params.clientId);await allowClient(req,id);res.json(await totalsForClient(id,req.user!.role==='admin'))}catch(error){financeError(res,error,'Failed to fetch invoice totals')}
})

// Get service totals for a client
router.get('/client/:clientId/service-totals', async (req, res) => {
  try {
    const { clientId } = req.params
    await allowClient(req,positiveId(clientId))

    const serviceTotals = await db
      .select({
        serviceId: invoiceServices.clientServiceId,
        serviceTypeName: serviceTypes.name,
        totalAmount: sql<number>`COALESCE(SUM(CAST(${invoiceServices.calculatedAmount} as DECIMAL)), 0)`
      })
      .from(invoiceServices)
      .innerJoin(invoices, eq(invoiceServices.invoiceId, invoices.id))
      .innerJoin(clientServices, eq(invoiceServices.clientServiceId, clientServices.id))
      .innerJoin(serviceTypes, eq(clientServices.serviceTypeId, serviceTypes.id))
      .where(and(eq(invoices.clientId, parseInt(clientId)),req.user!.role==='admin'?undefined:inArray(invoices.status,issuedStatuses)))
      .groupBy(invoiceServices.clientServiceId, serviceTypes.name)

    const result = serviceTotals.map(total => ({
      serviceId: total.serviceId,
      serviceTypeName: total.serviceTypeName,
      totalAmount: parseFloat(total.totalAmount.toString())
    }))

    res.json(result)
  } catch (error) {
    console.error('Get service totals error:', error)
    financeError(res,error,'Failed to fetch service totals')
  }
})

export { router as invoiceRouter }
