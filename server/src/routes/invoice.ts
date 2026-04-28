import { Router } from 'express'
import { eq, desc, and, sql, ne } from 'drizzle-orm'
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

    res.json({
      ...invoice,
      serviceIds: services.map((service) => service.serviceId),
      services: services.map((service) => ({
        ...service,
        serviceName: service.serviceTitle || service.serviceName,
        serviceTypeName: service.serviceName,
      })),
    })
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
      notes,
      serviceIds,
      useServicePricing,
      developerRates,
      servicePrices = {},
      paidAt,
      status
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
    const year = new Date().getFullYear()
    const latestInvoice = await db
      .select({ invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(sql`invoice_number LIKE ${`INV-${year}-%`}`)
      .orderBy(desc(invoices.invoiceNumber))
      .limit(1)

    let nextNumber = 1
    if (latestInvoice.length > 0 && latestInvoice[0].invoiceNumber) {
      const lastNumber = parseInt(latestInvoice[0].invoiceNumber.split('-')[2])
      nextNumber = lastNumber + 1
    }

    const invoiceNumber = `INV-${year}-${String(nextNumber).padStart(4, '0')}`

    // Determine status based on paidAt
    let invoiceStatus = status || 'draft'
    let paidAtDate = null
    if (paidAt) {
      invoiceStatus = 'paid'
      paidAtDate = new Date(paidAt)
    }

    const createdInvoice = await db.transaction(async (tx) => {
      const [newInvoice] = await tx.insert(invoices).values({
        clientId: parseInt(clientId),
        invoiceNumber,
        amount: amount.toString(),
        invoiceDate: invoiceDate || today,
        periodStart: periodStart || lastMonthStart,
        periodEnd: periodEnd || lastMonthEnd,
        description: description || null,
        dueDate: dueDate || null,
        notes: notes || null,
        status: invoiceStatus,
        paidAt: paidAtDate,
        createdBy: req.user!.id,
      }).returning()

      // If service-based pricing is used, create invoice_services and invoice_developers records
      if (useServicePricing && serviceIds) {
        for (const serviceId of serviceIds) {
          // Get service details
          const [serviceDetail] = await tx
            .select({
              id: clientServices.id,
              serviceTypeId: clientServices.serviceTypeId,
              serviceLevelPrice: clientServices.serviceLevelPrice,
            })
            .from(clientServices)
            .where(eq(clientServices.id, serviceId))

          if (!serviceDetail) continue

          // Calculate service amount
          let serviceAmount = 0

          // Get assigned developers
          const assignedDevelopers = await tx
            .select({
              id: clientServiceTeamMembers.id,
              teamMemberId: clientServiceTeamMembers.teamMemberId,
              hourlyRate: clientServiceTeamMembers.hourlyRate,
              fixedPrice: clientServiceTeamMembers.fixedPrice,
            })
            .from(clientServiceTeamMembers)
            .where(and(
              eq(clientServiceTeamMembers.clientServiceId, serviceId),
              eq(clientServiceTeamMembers.isActive, true)
            ))

          // Create invoice_services record
          const [invoiceService] = await tx.insert(invoiceServices).values({
            invoiceId: newInvoice.id,
            clientServiceId: serviceId,
            serviceLevelPrice: servicePrices[serviceId] !== undefined
              ? Number(servicePrices[serviceId]).toString()
              : serviceDetail.serviceLevelPrice || null,
            calculatedAmount: '0', // Will be updated after calculating developers
          }).returning()

          // Create invoice_developers records and calculate total
          let developerTotal = 0
          for (const developer of assignedDevelopers) {
            const devRates = developerRates?.[developer.teamMemberId] || developerRates?.[developer.id] || {}
            const hourlyRate = devRates.hourlyRate || parseFloat(developer.hourlyRate || '0')
            const fixedPrice = devRates.fixedPrice || parseFloat(developer.fixedPrice || '0')
            const hoursWorked = devRates.hoursWorked || 0

            let devAmount = 0
            if (fixedPrice > 0) {
              devAmount = fixedPrice
            } else if (hourlyRate > 0 && hoursWorked > 0) {
              devAmount = hourlyRate * hoursWorked
            }

            developerTotal += devAmount

            // Create invoice_developers record
            await tx.insert(invoiceDevelopers).values({
              invoiceServiceId: invoiceService.id,
              clientServiceTeamMemberId: developer.id,
              hourlyRate: hourlyRate > 0 ? hourlyRate.toString() : null,
              fixedPrice: fixedPrice > 0 ? fixedPrice.toString() : null,
              hoursWorked: hoursWorked > 0 ? hoursWorked : null,
              calculatedAmount: devAmount.toString(),
            })
          }

          // Use service-level price if available, otherwise use developer total
          serviceAmount = servicePrices[serviceId] !== undefined
            ? Number(servicePrices[serviceId])
            : parseFloat(serviceDetail.serviceLevelPrice || '0') || developerTotal

          // Update invoice_services with calculated amount
          await tx
            .update(invoiceServices)
            .set({ calculatedAmount: serviceAmount.toString() })
            .where(eq(invoiceServices.id, invoiceService.id))
        }
      }

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
    const { serviceIds, useServicePricing, developerRates, servicePrices = {} } = req.body
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

    if (Object.keys(updateData).length === 0 && !useServicePricing) {
      return res.status(400).json({ error: 'No fields to update' })
    }

    updateData.updatedAt = new Date()

    const [existingInvoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1)

    if (!existingInvoice) {
      return res.status(404).json({ error: 'Invoice not found' })
    }

    const updatedInvoice = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(invoices)
        .set(updateData)
        .where(eq(invoices.id, invoiceId))
        .returning()

      if (!row) return null

      // Handle service-based pricing updates
      if (useServicePricing && serviceIds && serviceIds.length > 0) {
        // First, delete existing invoice_services and invoice_developers
        const existingServices = await tx
          .select({ id: invoiceServices.id })
          .from(invoiceServices)
          .where(eq(invoiceServices.invoiceId, invoiceId))

        for (const service of existingServices) {
          // Delete invoice_developers first
          await tx
            .delete(invoiceDevelopers)
            .where(eq(invoiceDevelopers.invoiceServiceId, service.id))
        }

        // Delete invoice_services
        await tx
          .delete(invoiceServices)
          .where(eq(invoiceServices.invoiceId, invoiceId))

        // Now create new invoice_services and invoice_developers
        for (const serviceId of serviceIds) {
          // Get service details
          const [serviceDetail] = await tx
            .select({
              id: clientServices.id,
              serviceTypeId: clientServices.serviceTypeId,
              serviceLevelPrice: clientServices.serviceLevelPrice,
            })
            .from(clientServices)
            .where(eq(clientServices.id, serviceId))

          if (!serviceDetail) continue

          // Get assigned developers
          const assignedDevelopers = await tx
            .select({
              id: clientServiceTeamMembers.id,
              teamMemberId: clientServiceTeamMembers.teamMemberId,
              hourlyRate: clientServiceTeamMembers.hourlyRate,
              fixedPrice: clientServiceTeamMembers.fixedPrice,
            })
            .from(clientServiceTeamMembers)
            .where(and(
              eq(clientServiceTeamMembers.clientServiceId, serviceId),
              eq(clientServiceTeamMembers.isActive, true)
            ))

          // Create invoice_services record
          const [invoiceService] = await tx.insert(invoiceServices).values({
            invoiceId: invoiceId,
            clientServiceId: serviceId,
            serviceLevelPrice: servicePrices[serviceId] !== undefined
              ? Number(servicePrices[serviceId]).toString()
              : serviceDetail.serviceLevelPrice || null,
            calculatedAmount: '0', // Will be updated after calculating developers
          }).returning()

          // Create invoice_developers records and calculate total
          let developerTotal = 0
          for (const developer of assignedDevelopers) {
            const devRates = developerRates?.[developer.teamMemberId] || developerRates?.[developer.id] || {}
            const hourlyRate = devRates.hourlyRate || parseFloat(developer.hourlyRate || '0')
            const fixedPrice = devRates.fixedPrice || parseFloat(developer.fixedPrice || '0')
            const hoursWorked = devRates.hoursWorked || 0

            let devAmount = 0
            if (fixedPrice > 0) {
              devAmount = fixedPrice
            } else if (hourlyRate > 0 && hoursWorked > 0) {
              devAmount = hourlyRate * hoursWorked
            }

            developerTotal += devAmount

            // Create invoice_developers record
            if (devAmount > 0) {
              await tx.insert(invoiceDevelopers).values({
                invoiceServiceId: invoiceService.id,
                clientServiceTeamMemberId: developer.id,
                hourlyRate: hourlyRate > 0 ? hourlyRate.toString() : null,
                fixedPrice: fixedPrice > 0 ? fixedPrice.toString() : null,
                hoursWorked: hoursWorked > 0 ? hoursWorked : null,
                calculatedAmount: devAmount.toString(),
              })
            }
          }

          // Use service-level price if available, otherwise use developer total
          const serviceAmount = servicePrices[serviceId] !== undefined
            ? Number(servicePrices[serviceId])
            : parseFloat(serviceDetail.serviceLevelPrice || '0') || developerTotal

          // Update invoice_services with calculated amount
          await tx
            .update(invoiceServices)
            .set({ calculatedAmount: serviceAmount.toString() })
            .where(eq(invoiceServices.id, invoiceService.id))
        }
      }

      await logFinanceActivity(tx, {
        action: 'invoice_updated',
        entityType: 'invoice',
        entityId: row.id,
        invoiceId: row.id,
        clientId: row.clientId,
        actorId: req.user!.id,
        summary: `Updated invoice ${row.invoiceNumber}`,
        beforeData: pickInvoiceSnapshot(existingInvoice),
        afterData: pickInvoiceSnapshot(row),
        metadata: {
          changes: diffRecord(pickInvoiceSnapshot(existingInvoice), pickInvoiceSnapshot(row)),
          useServicePricing: Boolean(useServicePricing),
          serviceIds: serviceIds || [],
        },
      })

      return row
    })

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

    const deletedInvoice = await db.transaction(async (tx) => {
      const [existingInvoice] = await tx
        .select()
        .from(invoices)
        .where(eq(invoices.id, invoiceId))
        .limit(1)

      if (!existingInvoice) {
        return null
      }

      const invoiceServiceIds = await tx
        .select({ id: invoiceServices.id })
        .from(invoiceServices)
        .where(eq(invoiceServices.invoiceId, invoiceId))

      // Delete related records in the correct order
      if (invoiceServiceIds.length > 0) {
        const serviceIds = invoiceServiceIds.map(is => is.id)

        // Delete invoice developers first (references invoice_services)
        for (const serviceId of serviceIds) {
          await tx
            .delete(invoiceDevelopers)
            .where(eq(invoiceDevelopers.invoiceServiceId, serviceId))
        }

        // Delete invoice services (references invoices)
        await tx
          .delete(invoiceServices)
          .where(eq(invoiceServices.invoiceId, invoiceId))
      }

      // Finally delete the invoice itself
      const [row] = await tx
        .delete(invoices)
        .where(eq(invoices.id, invoiceId))
        .returning({ id: invoices.id })

      if (!row) return null

      await logFinanceActivity(tx, {
        action: 'invoice_deleted',
        entityType: 'invoice',
        entityId: existingInvoice.id,
        invoiceId: existingInvoice.id,
        clientId: existingInvoice.clientId,
        actorId: req.user!.id,
        summary: `Deleted invoice ${existingInvoice.invoiceNumber}`,
        beforeData: pickInvoiceSnapshot(existingInvoice),
      })

      return row
    })

    if (!deletedInvoice) {
      return res.status(404).json({ error: 'Invoice not found' })
    }

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
    const { serviceIds, periodStart, periodEnd, developerRates = {}, servicePrices = {} } = req.body

    console.log('Calculate pricing request:', {
      clientId,
      serviceIds,
      periodStart,
      periodEnd,
      developerRates,
      developerRateKeys: Object.keys(developerRates)
    })

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
          serviceTitle: clientServices.serviceTitle,
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
          id: clientServiceTeamMembers.id,
          teamMemberId: clientServiceTeamMembers.teamMemberId,
          developerName: teamMembers.name,
          currentHourlyRate: clientServiceTeamMembers.hourlyRate,
          currentFixedPrice: clientServiceTeamMembers.fixedPrice,
        })
        .from(clientServiceTeamMembers)
        .leftJoin(teamMembers, eq(clientServiceTeamMembers.teamMemberId, teamMembers.id))
        .where(and(
          eq(clientServiceTeamMembers.clientServiceId, serviceId),
          eq(clientServiceTeamMembers.isActive, true)
        ))

      console.log('Developer filtering start:', {
        serviceId,
        allAssignedDevelopers: assignedDevelopers.map(d => ({ id: d.id, teamMemberId: d.teamMemberId, name: d.developerName })),
        developerRateKeys: Object.keys(developerRates)
      })

      // Filter developers to only include those that have entries in developerRates
      // This ensures that when developers are removed from the UI, they're not included in calculations
      const activeDevelopers = assignedDevelopers.filter(dev => {
        // Check both developer ID formats to be safe
        const hasRatesByDeveloperId = Object.prototype.hasOwnProperty.call(developerRates, dev.teamMemberId.toString())
        const hasRatesById = Object.prototype.hasOwnProperty.call(developerRates, dev.id.toString())
        const shouldInclude = hasRatesByDeveloperId || hasRatesById

        console.log('Developer filter check:', {
          devId: dev.id,
          teamMemberId: dev.teamMemberId,
          name: dev.developerName,
          hasRatesByDeveloperId,
          hasRatesById,
          shouldInclude
        })

        return shouldInclude
      })

      console.log('Developer filtering end:', {
        activeDevelopers: activeDevelopers.map(d => ({ id: d.id, teamMemberId: d.teamMemberId, name: d.developerName }))
      })

      // Calculate developer costs
      let developerTotal = 0
      const developerCalculations = activeDevelopers.map(dev => {
        // Check both ID formats for developer rates
        const customRate = developerRates[dev.teamMemberId] || developerRates[dev.id] || {}
        const hourlyRate = customRate.hourlyRate !== undefined ? customRate.hourlyRate : parseFloat(dev.currentHourlyRate || '0')
        const fixedPrice = customRate.fixedPrice !== undefined ? customRate.fixedPrice : parseFloat(dev.currentFixedPrice || '0')
        const hoursWorked = customRate.hoursWorked || 0

        console.log('Processing developer in pricing:', {
          devId: dev.id,
          teamMemberId: dev.teamMemberId,
          developerName: dev.developerName,
          customRate,
          hourlyRate,
          fixedPrice,
          hoursWorked,
          serviceModel: serviceDetail.billingModel
        })

        let amount = 0

        // Check if user has provided custom rates - prioritize user input
        const hasCustomRates = Object.keys(customRate).length > 0

        if (hasCustomRates) {
          // User has provided custom rates - determine their intended mode
          // Check if user has explicitly set fixed price (including 0)
          if (customRate.fixedPrice !== undefined && customRate.hourlyRate === undefined && customRate.hoursWorked === undefined) {
            // User is in fixed mode - use fixed price even if 0
            amount = customRate.fixedPrice
          } else if (customRate.hourlyRate !== undefined || customRate.hoursWorked !== undefined) {
            // User is in hourly mode - use hourly calculation
            const userHourlyRate = customRate.hourlyRate || 0
            const userHoursWorked = customRate.hoursWorked || 0
            amount = userHourlyRate * userHoursWorked
          } else if (customRate.fixedPrice !== undefined && customRate.fixedPrice > 0) {
            // Fallback: user set a positive fixed price
            amount = customRate.fixedPrice
          }
        } else {
          // No custom rates - use defaults based on service billing model
          if (fixedPrice > 0) {
            amount = fixedPrice
          } else if (hourlyRate > 0 && hoursWorked > 0) {
            amount = hourlyRate * hoursWorked
          } else if (serviceDetail.billingModel === 'monthly' && hourlyRate > 0) {
            // Assume 160 hours per month for monthly billing
            amount = hourlyRate * 160
          }
        }

        console.log('Calculated amount for developer:', {
          hasCustomRates,
          customRate,
          finalAmount: amount
        })

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
      const customServicePrice = servicePrices[serviceId] !== undefined
        ? Number(servicePrices[serviceId])
        : undefined
      const finalAmount = customServicePrice !== undefined
        ? customServicePrice
        : serviceLevelPrice > 0
          ? serviceLevelPrice
          : developerTotal

      totalAmount += finalAmount

      calculations.push({
        serviceId,
        serviceName: serviceDetail.serviceTitle || serviceDetail.serviceName,
        serviceTypeName: serviceDetail.serviceName,
        serviceTitle: serviceDetail.serviceTitle,
        serviceLevelPrice: serviceLevelPrice > 0 ? serviceLevelPrice : undefined,
        developerTotal,
        finalAmount,
        developers: developerCalculations
      })
    }

    console.log('Pricing calculation response:', {
      totalAmount,
      servicesCount: calculations.length,
      calculations: calculations.map(c => ({
        serviceId: c.serviceId,
        serviceName: c.serviceName,
        developerCount: c.developers.length,
        developerTotal: c.developerTotal,
        finalAmount: c.finalAmount
      }))
    })

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
    console.log('=== GET CLIENT INVOICE TOTALS ===')
    console.log('Client ID:', clientId)

    const totals = await db
      .select({
        totalInvoiced: sql<number>`COALESCE(SUM(CAST(${invoices.amount} as DECIMAL)), 0)`,
        totalPaid: sql<number>`COALESCE(SUM(CASE WHEN ${invoices.paidAt} IS NOT NULL THEN CAST(${invoices.amount} as DECIMAL) ELSE 0 END), 0)`
      })
      .from(invoices)
      .where(eq(invoices.clientId, parseInt(clientId)))

    console.log('Raw totals from DB:', totals)
    const result = totals[0] || { totalInvoiced: 0, totalPaid: 0 }
    console.log('Result object:', result)

    const response = {
      totalInvoiced: parseFloat(result.totalInvoiced.toString()),
      totalPaid: parseFloat(result.totalPaid.toString())
    }
    console.log('Response being sent:', response)

    res.json(response)
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
