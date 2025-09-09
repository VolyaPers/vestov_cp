import { Router } from 'express'
import { eq, desc, and, sql, ne } from 'drizzle-orm'
import { db } from '../db/index.js'
import { 
  invoices, 
  clients, 
  clientServices, 
  serviceTypes, 
  clientServiceDevelopers, 
  developers,
  invoiceServices,
  invoiceDevelopers 
} from '../db/schema.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// Test endpoint without auth to debug
router.get('/test-totals/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params
    
    const totals = await db
      .select({
        totalInvoiced: sql<number>`COALESCE(SUM(CAST(${invoices.amount} as DECIMAL)), 0)`,
        totalPaid: sql<number>`COALESCE(SUM(CASE WHEN ${invoices.paidAt} IS NOT NULL THEN CAST(${invoices.amount} as DECIMAL) ELSE 0 END), 0)`
      })
      .from(invoices)
      .where(eq(invoices.clientId, parseInt(clientId)))

    const result = totals[0] || { totalInvoiced: 0, totalPaid: 0 }
    
    res.json({
      totalInvoiced: parseFloat(result.totalInvoiced.toString()),
      totalPaid: parseFloat(result.totalPaid.toString())
    })
  } catch (error) {
    console.error('Test totals error:', error)
    res.status(500).json({ error: 'Failed to fetch test totals' })
  }
})

// Test service totals endpoint without auth
router.get('/test-service-totals/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params

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
      .where(eq(invoices.clientId, parseInt(clientId)))
      .groupBy(invoiceServices.clientServiceId, serviceTypes.name)

    const result = serviceTotals.map(total => ({
      serviceId: total.serviceId,
      serviceTypeName: total.serviceTypeName,
      totalAmount: parseFloat(total.totalAmount.toString())
    }))
    
    res.json(result)
  } catch (error) {
    console.error('Test service totals error:', error)
    res.status(500).json({ error: 'Failed to fetch test service totals' })
  }
})

// Apply authentication middleware to all remaining routes
router.use(requireAuth)

// Get all invoices (admin only)
router.get('/', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' })
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
      .orderBy(desc(invoices.createdAt))
    
    res.json(allInvoices)
  } catch (error) {
    console.error('Get invoices error:', error)
    res.status(500).json({ error: 'Failed to fetch invoices' })
  }
})

// Get invoices for a specific client
router.get('/client/:clientId', async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId)
    
    // Check if user has access to this client's data
    if (req.user!.role !== 'admin' && req.user!.clientId !== clientId) {
      return res.status(403).json({ error: 'Access denied' })
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
      .orderBy(desc(invoices.createdAt))
    
    res.json(clientInvoices)
  } catch (error) {
    console.error('Get client invoices error:', error)
    res.status(500).json({ error: 'Failed to fetch client invoices' })
  }
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
    if (req.user!.role !== 'admin' && req.user!.clientId !== invoice.clientId) {
      return res.status(403).json({ error: 'Access denied' })
    }
    
    res.json(invoice)
  } catch (error) {
    console.error('Get invoice error:', error)
    res.status(500).json({ error: 'Failed to fetch invoice' })
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
      notes 
    } = req.body

    if (!clientId || !amount) {
      return res.status(400).json({ error: 'Client ID and amount are required' })
    }

    // Default values
    const today = new Date().toISOString().split('T')[0]
    const lastMonth = new Date()
    lastMonth.setMonth(lastMonth.getMonth() - 1)
    const lastMonthStart = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1).toISOString().split('T')[0]
    const lastMonthEnd = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0).toISOString().split('T')[0]

    // Generate invoice number
    const invoiceCount = await db.select({ count: invoices.id }).from(invoices)
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invoiceCount.length + 1).padStart(4, '0')}`

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
      createdBy: req.user!.id,
    }).returning()
    
    res.json(newInvoice)
  } catch (error) {
    console.error('Create invoice error:', error)
    res.status(500).json({ error: 'Failed to create invoice' })
  }
})

// Update an invoice (admin only)
router.put('/:id', async (req, res) => {
  try {
    // Only admins can update invoices
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' })
    }

    const invoiceId = parseInt(req.params.id)
    const updateData: any = {}

    // Only update fields that are provided
    const allowedFields = ['amount', 'invoiceDate', 'periodStart', 'periodEnd', 'description', 'status', 'dueDate', 'paidAt', 'notes']
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'amount') {
          updateData[field] = req.body[field].toString()
        } else if (field === 'paidAt') {
          // Handle paidAt - can be ISO string or null
          if (req.body[field] && req.body[field] !== '') {
            updateData[field] = new Date(req.body[field])
          } else {
            updateData[field] = null
          }
        } else if (['invoiceDate', 'periodStart', 'periodEnd', 'dueDate'].includes(field)) {
          // Handle date fields - convert empty strings to null
          if (req.body[field] && req.body[field] !== '') {
            updateData[field] = req.body[field]
          } else {
            updateData[field] = null
          }
        } else {
          updateData[field] = req.body[field]
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields to update' })
    }

    updateData.updatedAt = new Date()

    const [updatedInvoice] = await db
      .update(invoices)
      .set(updateData)
      .where(eq(invoices.id, invoiceId))
      .returning()
    
    if (!updatedInvoice) {
      return res.status(404).json({ error: 'Invoice not found' })
    }
    
    res.json(updatedInvoice)
  } catch (error) {
    console.error('Update invoice error:', error)
    res.status(500).json({ error: 'Failed to update invoice' })
  }
})

// Delete an invoice (admin only)
router.delete('/:id', async (req, res) => {
  try {
    // Only admins can delete invoices
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' })
    }

    const invoiceId = parseInt(req.params.id)

    // Check if invoice exists
    const existingInvoice = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1)

    if (!existingInvoice.length) {
      return res.status(404).json({ error: 'Invoice not found' })
    }

    // Get all invoice service IDs to delete related records
    const invoiceServiceIds = await db
      .select({ id: invoiceServices.id })
      .from(invoiceServices)
      .where(eq(invoiceServices.invoiceId, invoiceId))

    // Delete related records in the correct order
    if (invoiceServiceIds.length > 0) {
      const serviceIds = invoiceServiceIds.map(is => is.id)
      
      // Delete invoice developers first (references invoice_services)
      for (const serviceId of serviceIds) {
        await db
          .delete(invoiceDevelopers)
          .where(eq(invoiceDevelopers.invoiceServiceId, serviceId))
      }
      
      // Delete invoice services (references invoices)
      await db
        .delete(invoiceServices)
        .where(eq(invoiceServices.invoiceId, invoiceId))
    }

    // Finally delete the invoice itself
    const [deletedInvoice] = await db
      .delete(invoices)
      .where(eq(invoices.id, invoiceId))
      .returning({ id: invoices.id })
    
    console.log('Invoice deleted successfully:', deletedInvoice.id)
    res.json({ message: 'Invoice deleted successfully' })
  } catch (error) {
    console.error('Delete invoice error:', error)
    res.status(500).json({ error: 'Failed to delete invoice' })
  }
})

// Get client service options for invoice creation
router.get('/client-service-options/:clientId', async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId)
    
    // Check if user has access to this client's data
    if (req.user!.role !== 'admin' && req.user!.clientId !== clientId) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Get client's active services with their developers
    const clientServicesWithDevelopers = await db
      .select({
        id: clientServices.id,
        serviceId: clientServices.serviceTypeId,
        serviceName: serviceTypes.name,
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
            id: clientServiceDevelopers.id,
            developerId: clientServiceDevelopers.developerId,
            developerName: developers.name,
            hourlyRate: clientServiceDevelopers.hourlyRate,
            fixedPrice: clientServiceDevelopers.fixedPrice,
            employmentType: clientServiceDevelopers.employmentType,
            isActive: clientServiceDevelopers.isActive,
          })
          .from(clientServiceDevelopers)
          .leftJoin(developers, eq(clientServiceDevelopers.developerId, developers.id))
          .where(and(
            eq(clientServiceDevelopers.clientServiceId, service.id),
            eq(clientServiceDevelopers.isActive, true)
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
    res.status(500).json({ error: 'Failed to fetch service options' })
  }
})

// Calculate pricing for services
router.post('/calculate-pricing/:clientId', async (req, res) => {
  try {
    // Only admins can calculate pricing
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' })
    }

    const clientId = parseInt(req.params.clientId)
    const { serviceIds, periodStart, periodEnd, developerRates = {} } = req.body

    if (!serviceIds || serviceIds.length === 0) {
      return res.status(400).json({ error: 'Service IDs are required' })
    }

    const calculations = []
    let totalAmount = 0

    for (const serviceId of serviceIds) {
      // Get service details
      const [serviceDetail] = await db
        .select({
          id: clientServices.id,
          serviceId: clientServices.serviceTypeId,
          serviceName: serviceTypes.name,
          serviceCategory: serviceTypes.category,
          billingModel: serviceTypes.billingModel,
          serviceLevelPrice: clientServices.serviceLevelPrice,
        })
        .from(clientServices)
        .leftJoin(serviceTypes, eq(clientServices.serviceTypeId, serviceTypes.id))
        .where(and(
          eq(clientServices.clientId, clientId),
          eq(clientServices.id, serviceId)
        ))

      if (!serviceDetail) continue

      // Get assigned developers for this service
      const assignedDevelopers = await db
        .select({
          id: clientServiceDevelopers.id,
          developerId: clientServiceDevelopers.developerId,
          developerName: developers.name,
          currentHourlyRate: clientServiceDevelopers.hourlyRate,
          currentFixedPrice: clientServiceDevelopers.fixedPrice,
        })
        .from(clientServiceDevelopers)
        .leftJoin(developers, eq(clientServiceDevelopers.developerId, developers.id))
        .where(and(
          eq(clientServiceDevelopers.clientServiceId, serviceId),
          eq(clientServiceDevelopers.isActive, true)
        ))

      // Calculate developer costs
      let developerTotal = 0
      const developerCalculations = assignedDevelopers.map(dev => {
        const customRate = developerRates[dev.id] || {}
        const hourlyRate = customRate.hourlyRate !== undefined ? customRate.hourlyRate : parseFloat(dev.currentHourlyRate || '0')
        const fixedPrice = customRate.fixedPrice !== undefined ? customRate.fixedPrice : parseFloat(dev.currentFixedPrice || '0')
        const hoursWorked = customRate.hoursWorked || 0

        let amount = 0
        if (serviceDetail.billingModel === 'hourly' && hourlyRate && hoursWorked) {
          amount = hourlyRate * hoursWorked
        } else if (serviceDetail.billingModel === 'fixed' && fixedPrice) {
          amount = fixedPrice
        } else if (serviceDetail.billingModel === 'monthly' && hourlyRate) {
          // Assume 160 hours per month for monthly billing
          amount = hourlyRate * 160
        }

        developerTotal += amount
        return {
          id: dev.id,
          name: dev.developerName,
          hourlyRate: hourlyRate || undefined,
          fixedPrice: fixedPrice || undefined,
          hoursWorked: hoursWorked || undefined,
          amount
        }
      })

      // Use service-level price if available, otherwise use developer total
      const serviceLevelPrice = parseFloat(serviceDetail.serviceLevelPrice || '0')
      const finalAmount = serviceLevelPrice > 0 ? serviceLevelPrice : developerTotal

      totalAmount += finalAmount

      calculations.push({
        serviceId,
        serviceName: serviceDetail.serviceName,
        serviceLevelPrice: serviceLevelPrice > 0 ? serviceLevelPrice : undefined,
        developerTotal,
        finalAmount,
        developers: developerCalculations
      })
    }

    res.json({
      totalAmount,
      services: calculations
    })
  } catch (error) {
    console.error('Calculate pricing error:', error)
    res.status(500).json({ error: 'Failed to calculate pricing' })
  }
})

// Get client invoice totals
router.get('/client/:clientId/totals', async (req, res) => {
  try {
    const { clientId } = req.params

    const totals = await db
      .select({
        totalInvoiced: sql<number>`COALESCE(SUM(CAST(${invoices.amount} as DECIMAL)), 0)`,
        totalPaid: sql<number>`COALESCE(SUM(CASE WHEN ${invoices.paidAt} IS NOT NULL THEN CAST(${invoices.amount} as DECIMAL) ELSE 0 END), 0)`
      })
      .from(invoices)
      .where(eq(invoices.clientId, parseInt(clientId)))

    const result = totals[0] || { totalInvoiced: 0, totalPaid: 0 }
    
    res.json({
      totalInvoiced: parseFloat(result.totalInvoiced.toString()),
      totalPaid: parseFloat(result.totalPaid.toString())
    })
  } catch (error) {
    console.error('Get client invoice totals error:', error)
    res.status(500).json({ error: 'Failed to fetch client invoice totals' })
  }
})

// Get service totals for a client
router.get('/client/:clientId/service-totals', async (req, res) => {
  try {
    const { clientId } = req.params

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
      .where(eq(invoices.clientId, parseInt(clientId)))
      .groupBy(invoiceServices.clientServiceId, serviceTypes.name)

    const result = serviceTotals.map(total => ({
      serviceId: total.serviceId,
      serviceTypeName: total.serviceTypeName,
      totalAmount: parseFloat(total.totalAmount.toString())
    }))
    
    res.json(result)
  } catch (error) {
    console.error('Get service totals error:', error)
    res.status(500).json({ error: 'Failed to fetch service totals' })
  }
})

export { router as invoiceRouter }