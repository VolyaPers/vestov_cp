import { Router } from 'express'
import { Pool } from 'pg'
import { eq, desc, and, sql, inArray } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { serviceTypes, clientServices, clients, teamMembers, users, clientServiceTeamMembers, clientUsers } from '../db/schema.js'
import * as schema from '../db/schema.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/vestov_portal',
})
const db = drizzle(pool, { schema })

// Get all service types
router.get('/service-types', requireAuth, async (req, res) => {
  try {
    console.log('Fetching service types for user:', req.user?.username)
    const services = await db
      .select()
      .from(serviceTypes)
      .orderBy(desc(serviceTypes.createdAt))

    console.log('Found', services.length, 'service types')
    res.json(services)
  } catch (error) {
    console.error('Error fetching service types:', error)
    res.status(500).json({ error: 'Failed to fetch service types' })
  }
})

// Create new service type
router.post('/service-types', requireAuth, async (req, res) => {
  try {
    const { name, description, category, billingModel } = req.body

    if (!name || !category || !billingModel) {
      return res.status(400).json({ error: 'Name, category, and billing model are required' })
    }

    const [newService] = await db
      .insert(serviceTypes)
      .values({
        name,
        description,
        category,
        billingModel,
      })
      .returning()

    res.status(201).json(newService)
  } catch (error) {
    console.error('Error creating service type:', error)
    res.status(500).json({ error: 'Failed to create service type' })
  }
})

// Update service type
router.put('/service-types/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const { name, description, category, billingModel } = req.body

    const [updatedService] = await db
      .update(serviceTypes)
      .set({
        name,
        description,
        category,
        billingModel,
        updatedAt: new Date(),
      })
      .where(eq(serviceTypes.id, parseInt(id)))
      .returning()

    if (!updatedService) {
      return res.status(404).json({ error: 'Service type not found' })
    }

    res.json(updatedService)
  } catch (error) {
    console.error('Error updating service type:', error)
    res.status(500).json({ error: 'Failed to update service type' })
  }
})

// Delete service type
router.delete('/service-types/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    console.log('Attempting to delete service type:', id)

    // Check if service type is in active use (only check active assignments)
    const usage = await db
      .select({ count: sql`count(*)` })
      .from(clientServices)
      .where(and(
        eq(clientServices.serviceTypeId, parseInt(id)),
        eq(clientServices.isActive, true)
      ))

    console.log('Active service usage count:', usage[0]?.count)

    if (Number(usage[0]?.count) > 0) {
      console.log('Service is actively in use, cannot delete')
      return res.status(400).json({ error: 'Cannot delete service type that is in use' })
    }

    const [deletedService] = await db
      .delete(serviceTypes)
      .where(eq(serviceTypes.id, parseInt(id)))
      .returning()

    if (!deletedService) {
      console.log('Service type not found:', id)
      return res.status(404).json({ error: 'Service type not found' })
    }

    console.log('Service type deleted successfully:', deletedService.name)
    res.json({ message: 'Service type deleted successfully' })
  } catch (error) {
    console.error('Error deleting service type:', error)
    res.status(500).json({ error: 'Failed to delete service type' })
  }
})

// Get client services with details
router.get('/client-services', requireAuth, async (req, res) => {
  try {
    const services = await db
      .select({
        id: clientServices.id,
        clientId: clientServices.clientId,
        clientName: clients.name,
        serviceTypeId: clientServices.serviceTypeId,
        serviceTypeName: serviceTypes.name,
        serviceCategory: serviceTypes.category,
        billingModel: serviceTypes.billingModel,
        rate: clientServices.rate,
        serviceTitle: clientServices.serviceTitle,
        startDate: clientServices.startDate,
        endDate: clientServices.endDate,
        isActive: clientServices.isActive,
        createdAt: clientServices.createdAt,
      })
      .from(clientServices)
      .leftJoin(clients, eq(clientServices.clientId, clients.id))
      .leftJoin(serviceTypes, eq(clientServices.serviceTypeId, serviceTypes.id))
      .orderBy(desc(clientServices.createdAt))

    res.json(services)
  } catch (error) {
    console.error('Error fetching client services:', error)
    res.status(500).json({ error: 'Failed to fetch client services' })
  }
})

// Create new client service assignment
router.post('/client-services', requireAuth, async (req, res) => {
  try {
    const { clientId, serviceTypeId, rate, startDate, endDate } = req.body

    if (!clientId || !serviceTypeId || !startDate) {
      return res.status(400).json({ error: 'Client ID, service type ID, and start date are required' })
    }

    const [newClientService] = await db
      .insert(clientServices)
      .values({
        clientId: parseInt(clientId),
        serviceTypeId: parseInt(serviceTypeId),
        serviceTitle: req.body.serviceTitle || null,
        rate: rate ? rate.toString() : null,
        startDate,
        endDate: endDate || null,
      })
      .returning()

    res.status(201).json(newClientService)
  } catch (error) {
    console.error('Error creating client service:', error)
    res.status(500).json({ error: 'Failed to create client service' })
  }
})

// Update client service
router.put('/client-services/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const { rate, endDate, isActive } = req.body

    const [updatedService] = await db
      .update(clientServices)
      .set({
        serviceTitle: req.body.serviceTitle !== undefined ? req.body.serviceTitle : undefined,
        rate: rate ? rate.toString() : null,
        endDate: endDate || null,
        isActive: isActive !== undefined ? isActive : true,
      })
      .where(eq(clientServices.id, parseInt(id)))
      .returning()

    if (!updatedService) {
      return res.status(404).json({ error: 'Client service not found' })
    }

    res.json(updatedService)
  } catch (error) {
    console.error('Error updating client service:', error)
    res.status(500).json({ error: 'Failed to update client service' })
  }
})

// Get service analytics
router.get('/analytics', requireAuth, async (req, res) => {
  try {
    // Service type distribution
    const serviceDistribution = await db
      .select({
        category: serviceTypes.category,
        count: sql`count(${clientServices.id})`,
        totalRevenue: sql`sum(${clientServices.rate})`,
      })
      .from(serviceTypes)
      .leftJoin(clientServices, and(
        eq(serviceTypes.id, clientServices.serviceTypeId),
        eq(clientServices.isActive, true)
      ))
      .groupBy(serviceTypes.category)

    // Active services count
    const activeServicesCount = await db
      .select({ count: sql`count(*)` })
      .from(clientServices)
      .where(eq(clientServices.isActive, true))

    // Top services by revenue
    const topServices = await db
      .select({
        serviceTypeName: serviceTypes.name,
        category: serviceTypes.category,
        activeAssignments: sql`count(${clientServices.id})`,
        totalRevenue: sql`sum(${clientServices.rate})`,
      })
      .from(serviceTypes)
      .leftJoin(clientServices, and(
        eq(serviceTypes.id, clientServices.serviceTypeId),
        eq(clientServices.isActive, true)
      ))
      .groupBy(serviceTypes.id, serviceTypes.name, serviceTypes.category)
      .orderBy(sql`sum(${clientServices.rate}) desc nulls last`)
      .limit(5)

    res.json({
      serviceDistribution,
      activeServicesCount: activeServicesCount[0]?.count || 0,
      topServices,
    })
  } catch (error) {
    console.error('Error fetching service analytics:', error)
    res.status(500).json({ error: 'Failed to fetch service analytics' })
  }
})

// Client Management Routes

// Client analytics (must come before /clients/:id route)
router.get('/clients/analytics', requireAuth, async (req, res) => {
  try {
    // Total clients count
    const totalClients = await db
      .select({ count: sql`count(*)` })
      .from(clients)

    // Active clients (those with active services)
    const activeClients = await db
      .select({ count: sql`count(distinct ${clients.id})` })
      .from(clients)
      .innerJoin(clientServices, eq(clients.id, clientServices.clientId))
      .where(eq(clientServices.isActive, true))

    // Total revenue from all active services
    const totalRevenue = await db
      .select({ total: sql`sum(${clientServices.rate})` })
      .from(clientServices)
      .where(eq(clientServices.isActive, true))

    // Top clients by revenue
    const topClients = await db
      .select({
        clientId: clients.id,
        clientName: clients.name,
        activeServices: sql`count(${clientServices.id})`,
        totalRevenue: sql`sum(${clientServices.rate})`,
      })
      .from(clients)
      .leftJoin(clientServices, and(
        eq(clients.id, clientServices.clientId),
        eq(clientServices.isActive, true)
      ))
      .groupBy(clients.id, clients.name)
      .orderBy(sql`sum(${clientServices.rate}) desc nulls last`)
      .limit(5)

    res.json({
      totalClients: totalClients[0]?.count || 0,
      activeClients: activeClients[0]?.count || 0,
      totalRevenue: totalRevenue[0]?.total || 0,
      topClients,
    })
  } catch (error) {
    console.error('Error fetching client analytics:', error)
    res.status(500).json({ error: 'Failed to fetch client analytics' })
  }
})

// Rate limiting for infinite loop protection
const lastRequestTimes = new Map()

// Get all clients with their service assignments
router.get('/clients', requireAuth, async (req, res) => {
  try {
    console.log('Fetching clients for user:', req.user?.username, 'role:', req.user?.role)

    let clientsWithServices;

    if (req.user?.role === 'admin' || req.user?.role === 'team_member') {
      // Admin and team members can see all clients
      clientsWithServices = await db
        .select({
          id: clients.id,
          name: clients.name,
          industry: clients.industry,
          contactEmail: clients.email,
          contactPhone: clients.phone,
          address: clients.address,
          contractType: clients.contractType,
          contractStartDate: clients.contractStart,
          contractEndDate: clients.contractEnd,
          billingCycle: clients.billingCycle,
          status: clients.status,
          teamSize: clients.teamSize,
          logoUrl: clients.logoUrl,
          createdAt: clients.createdAt,
        })
        .from(clients)
        .orderBy(desc(clients.createdAt))
    } else if (req.user?.role === 'client') {
      // Client users can only see clients they are assigned to
      console.log('[GET /clients] Client user query - userId:', req.user.id, 'email:', req.user.email)

      clientsWithServices = await db
        .select({
          id: clients.id,
          name: clients.name,
          industry: clients.industry,
          contactEmail: clients.email,
          contactPhone: clients.phone,
          address: clients.address,
          contractType: clients.contractType,
          contractStartDate: clients.contractStart,
          contractEndDate: clients.contractEnd,
          billingCycle: clients.billingCycle,
          status: clients.status,
          teamSize: clients.teamSize,
          logoUrl: clients.logoUrl,
          createdAt: clients.createdAt,
          accessLevel: clientUsers.accessLevel,
        })
        .from(clients)
        .innerJoin(clientUsers, eq(clients.id, clientUsers.clientId))
        .where(and(
          eq(clientUsers.userId, req.user.id),
          eq(clientUsers.isActive, true)
        ))
        .orderBy(desc(clients.createdAt))

      console.log('[GET /clients] Found', clientsWithServices.length, 'clients for user:', req.user.email)
    } else {
      // Unknown role, no access
      console.log('[GET /clients] Unknown role or access denied:', req.user?.role)
      return res.status(403).json({ error: 'Access denied' })
    }

    const clientIds = clientsWithServices.map((client) => client.id)
    const allServices = clientIds.length > 0
      ? await db
          .select({
            id: clientServices.id,
            clientId: clientServices.clientId,
            serviceTypeId: clientServices.serviceTypeId,
            serviceTypeName: serviceTypes.name,
            serviceCategory: serviceTypes.category,
            billingModel: serviceTypes.billingModel,
            rate: clientServices.rate,
            serviceTitle: clientServices.serviceTitle,
            serviceLevelPrice: clientServices.serviceLevelPrice,
            startDate: clientServices.startDate,
            endDate: clientServices.endDate,
            isActive: clientServices.isActive,
          })
          .from(clientServices)
          .leftJoin(serviceTypes, eq(clientServices.serviceTypeId, serviceTypes.id))
          .where(inArray(clientServices.clientId, clientIds))
      : []

    const servicesByClient = new Map<number, typeof allServices>()
    for (const service of allServices) {
      const existing = servicesByClient.get(service.clientId) ?? []
      existing.push(service)
      servicesByClient.set(service.clientId, existing)
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const clientsWithServiceData = clientsWithServices.map((client) => {
      const services = servicesByClient.get(client.id) ?? []

      const hasActiveService = services.some((service) => {
        if (!service.endDate) {
          return true
        }

        const endDate = new Date(service.endDate)
        endDate.setHours(0, 0, 0, 0)
        return endDate >= today
      })

      const calculatedStatus = services.length === 0
        ? 'inactive'
        : hasActiveService
          ? 'active'
          : 'inactive'

      return {
        ...client,
        status: calculatedStatus,
        services,
        activeServicesCount: services.filter((service) => service.isActive).length,
        totalMonthlyRevenue: services
          .filter((service) => service.isActive)
          .reduce((sum, service) => sum + (parseFloat(service.rate?.toString() || '0') || 0), 0),
      }
    })

    console.log(`Found ${clientsWithServiceData.length} clients`)
    res.json(clientsWithServiceData)
  } catch (error) {
    console.error('Error fetching clients:', error)
    res.status(500).json({ error: 'Failed to fetch clients' })
  }
})

router.get('/service-developer-assignments', requireAuth, async (req, res) => {
  try {
    const rawClientId = typeof req.query.clientId === 'string' ? Number.parseInt(req.query.clientId, 10) : NaN
    const rawClientIds = typeof req.query.clientIds === 'string'
      ? req.query.clientIds
          .split(',')
          .map((value) => Number.parseInt(value.trim(), 10))
          .filter((value) => Number.isFinite(value))
      : []

    const requestedClientIds = Array.from(new Set([
      ...rawClientIds,
      ...(Number.isFinite(rawClientId) ? [rawClientId] : []),
    ]))

    let visibleClientIds = requestedClientIds

    if (req.user?.role === 'client') {
      const assignments = await db
        .select({ clientId: clientUsers.clientId })
        .from(clientUsers)
        .where(and(
          eq(clientUsers.userId, req.user.id),
          eq(clientUsers.isActive, true),
        ))

      const allowedClientIds = assignments.map((assignment) => assignment.clientId)
      visibleClientIds = requestedClientIds.length > 0
        ? requestedClientIds.filter((clientId) => allowedClientIds.includes(clientId))
        : allowedClientIds

      if (requestedClientIds.length > 0 && visibleClientIds.length !== requestedClientIds.length) {
        return res.status(403).json({ error: 'Access denied' })
      }
    }

    if (req.user?.role === 'client' && visibleClientIds.length === 0) {
      return res.json({})
    }

    const conditions = []
    if (visibleClientIds.length > 0) {
      conditions.push(inArray(clientServices.clientId, visibleClientIds))
    }

    const rows = await db
      .select({
        id: clientServiceTeamMembers.id,
        clientId: clientServices.clientId,
        serviceId: clientServices.id,
        developerId: clientServiceTeamMembers.teamMemberId,
        name: teamMembers.name,
        email: teamMembers.email,
        avatarUrl: teamMembers.avatarUrl,
        skills: teamMembers.skills,
        hourlyRate: clientServiceTeamMembers.hourlyRate,
        fixedPrice: clientServiceTeamMembers.fixedPrice,
        workSchedule: clientServiceTeamMembers.workSchedule,
        employmentType: clientServiceTeamMembers.employmentType,
        isActive: clientServiceTeamMembers.isActive,
        startDate: clientServiceTeamMembers.startDate,
        endDate: clientServiceTeamMembers.endDate,
      })
      .from(clientServiceTeamMembers)
      .leftJoin(teamMembers, eq(clientServiceTeamMembers.teamMemberId, teamMembers.id))
      .leftJoin(clientServices, eq(clientServiceTeamMembers.clientServiceId, clientServices.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(clientServiceTeamMembers.createdAt))

    const assignmentsByService: Record<number, typeof rows> = {}
    for (const row of rows) {
      if (!assignmentsByService[row.serviceId]) {
        assignmentsByService[row.serviceId] = []
      }
      assignmentsByService[row.serviceId].push(row)
    }

    res.json(assignmentsByService)
  } catch (error) {
    console.error('Error fetching batched service developers:', error)
    res.status(500).json({ error: 'Failed to fetch batched service developers' })
  }
})

// Get specific client with detailed service assignments
router.get('/clients/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    console.log('Fetching client details for ID:', id)

    // Validate that id is a valid number
    const clientId = parseInt(id)
    if (isNaN(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID format' })
    }

    // Check if user has access to this client
    let userAccessLevel: string | null = null
    if (req.user?.role === 'client') {
      // Client users can only access clients they are assigned to
      const clientAccess = await db
        .select()
        .from(clientUsers)
        .where(and(
          eq(clientUsers.userId, req.user.id),
          eq(clientUsers.clientId, clientId),
          eq(clientUsers.isActive, true)
        ))
        .limit(1)

      if (clientAccess.length === 0) {
        return res.status(403).json({ error: 'Access denied to this client' })
      }
      userAccessLevel = clientAccess[0].accessLevel
    }

    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))

    if (!client) {
      return res.status(404).json({ error: 'Client not found' })
    }

    // Get all service assignments with details
    const services = await db
      .select({
        id: clientServices.id,
        serviceTypeId: clientServices.serviceTypeId,
        serviceTypeName: serviceTypes.name,
        serviceDescription: serviceTypes.description,
        serviceCategory: serviceTypes.category,
        billingModel: serviceTypes.billingModel,
        rate: clientServices.rate,
        serviceTitle: clientServices.serviceTitle,
        serviceLevelPrice: clientServices.serviceLevelPrice,
        startDate: clientServices.startDate,
        endDate: clientServices.endDate,
        isActive: clientServices.isActive,
        slackChannelId: clientServices.slackChannelId,
        createdAt: clientServices.createdAt,
      })
      .from(clientServices)
      .leftJoin(serviceTypes, eq(clientServices.serviceTypeId, serviceTypes.id))
      .where(eq(clientServices.clientId, clientId))
      .orderBy(desc(clientServices.createdAt))

    // Calculate if client is active based on services
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const hasActiveService = services.some(service => {
      if (!service.endDate) {
        return true // Ongoing service
      }
      const endDate = new Date(service.endDate)
      endDate.setHours(0, 0, 0, 0)
      return endDate >= today // Active if end date is today or later
    })

    const calculatedStatus = services.length === 0
      ? 'inactive'
      : hasActiveService
        ? 'active'
        : 'inactive'

    res.json({
      ...client,
      status: calculatedStatus, // Override status with calculated value
      services,
      // Include access level for client users
      ...(userAccessLevel && { accessLevel: userAccessLevel }),
    })
  } catch (error) {
    console.error('Error fetching client details:', error)
    res.status(500).json({ error: 'Failed to fetch client details' })
  }
})

// Remove/deactivate client service assignment
router.delete('/clients/:clientId/services/:serviceId', requireAuth, async (req, res) => {
  try {
    const { clientId, serviceId } = req.params
    const { permanent } = req.query
    console.log(`${permanent ? 'Permanently deleting' : 'Deactivating'} service ${serviceId} from client ${clientId}`)

    if (permanent === 'true') {
      // Permanently delete the service assignment
      const [deletedService] = await db
        .delete(clientServices)
        .where(and(
          eq(clientServices.clientId, parseInt(clientId)),
          eq(clientServices.id, parseInt(serviceId))
        ))
        .returning()

      if (!deletedService) {
        return res.status(404).json({ error: 'Service assignment not found' })
      }

      console.log('Service assignment permanently deleted')
      res.json({ message: 'Service assignment permanently removed', service: deletedService })
    } else {
      // Just deactivate the service assignment
      const [updatedService] = await db
        .update(clientServices)
        .set({
          isActive: false,
          endDate: new Date().toISOString().split('T')[0], // Set end date to today
        })
        .where(and(
          eq(clientServices.clientId, parseInt(clientId)),
          eq(clientServices.id, parseInt(serviceId))
        ))
        .returning()

      if (!updatedService) {
        return res.status(404).json({ error: 'Service assignment not found' })
      }

      console.log('Service assignment deactivated successfully')
      res.json({ message: 'Service assignment deactivated successfully', service: updatedService })
    }
  } catch (error) {
    console.error('Error removing service assignment:', error)
    res.status(500).json({ error: 'Failed to remove service assignment' })
  }
})

// Add service to client
router.post('/clients/:clientId/services', requireAuth, async (req, res) => {
  try {
    const { clientId } = req.params
    const { serviceTypeId, rate, startDate } = req.body
    console.log(`Adding service ${serviceTypeId} to client ${clientId}`)

    if (!serviceTypeId || !startDate) {
      return res.status(400).json({ error: 'Service type and start date are required' })
    }

    const [newAssignment] = await db
      .insert(clientServices)
      .values({
        clientId: parseInt(clientId),
        serviceTypeId: parseInt(serviceTypeId),
        serviceTitle: req.body.serviceTitle || null,
        slackChannelId: req.body.slackChannelId || null,
        rate: rate ? rate.toString() : null,
        startDate,
        isActive: true,
      })
      .returning()

    console.log('Service assignment created successfully')
    res.status(201).json(newAssignment)
  } catch (error) {
    console.error('Error adding service to client:', error)
    res.status(500).json({ error: 'Failed to add service to client' })
  }
})

// Create new client
router.post('/clients', requireAuth, async (req, res) => {
  try {
    const {
      name,
      industry,
      contactPerson,
      email,
      phone,
      address,
      contractType,
      contractStart,
      contractEnd,
      billingCycle,
      teamSize
    } = req.body
    console.log('Creating new client:', name)

    if (!name) {
      return res.status(400).json({ error: 'Name is required' })
    }

    if (contractType && !['outstaffing', 'outsourcing', 'hybrid'].includes(contractType)) {
      return res.status(400).json({ error: 'Contract type must be outstaffing, outsourcing, or hybrid' })
    }

    const [newClient] = await db
      .insert(clients)
      .values({
        name,
        industry,
        contactPerson,
        email,
        phone,
        address,
        contractType,
        contractStart,
        contractEnd,
        billingCycle,
        teamSize: teamSize ? parseInt(teamSize) : 0,
        status: 'active'
      })
      .returning()

    console.log('Client created successfully:', newClient.name)
    res.status(201).json(newClient)
  } catch (error) {
    console.error('Error creating client:', error)
    res.status(500).json({ error: 'Failed to create client' })
  }
})

// Update client
router.put('/clients/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const {
      name,
      industry,
      contactPerson,
      email,
      phone,
      address,
      status,
      contractType,
      contractStart,
      contractEnd,
      billingCycle,
      teamSize
    } = req.body
    console.log('Updating client:', id)

    const [updatedClient] = await db
      .update(clients)
      .set({
        name,
        industry,
        contactPerson,
        email,
        phone,
        address,
        status,
        contractType,
        contractStart,
        contractEnd,
        billingCycle,
        teamSize: teamSize ? parseInt(teamSize) : null,
        updatedAt: new Date()
      })
      .where(eq(clients.id, parseInt(id)))
      .returning()

    if (!updatedClient) {
      return res.status(404).json({ error: 'Client not found' })
    }

    console.log('Client updated successfully:', updatedClient.name)
    res.json(updatedClient)
  } catch (error) {
    console.error('Error updating client:', error)
    res.status(500).json({ error: 'Failed to update client' })
  }
})

// Get all developers
router.get('/developers', requireAuth, async (req, res) => {
  try {
    console.log('Fetching developers for user:', req.user?.username)
    const devs = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.isBillable, true))
      .orderBy(desc(teamMembers.createdAt))

    console.log('Found', devs.length, 'developers')
    res.json(devs)
  } catch (error) {
    console.error('Error fetching developers:', error)
    res.status(500).json({ error: 'Failed to fetch developers' })
  }
})

// Get developers assigned to a specific client service
router.get('/clients/:clientId/services/:serviceId/developers', requireAuth, async (req, res) => {
  try {
    const { clientId, serviceId } = req.params
    console.log(`Fetching developers for client ${clientId}, service ${serviceId}`)

    const assignedDevelopers = await db
      .select({
        id: clientServiceTeamMembers.id,
        developerId: clientServiceTeamMembers.teamMemberId,
        name: teamMembers.name,
        email: teamMembers.email,
        avatarUrl: teamMembers.avatarUrl,
        skills: teamMembers.skills,
        hourlyRate: clientServiceTeamMembers.hourlyRate,
        fixedPrice: clientServiceTeamMembers.fixedPrice,
        workSchedule: clientServiceTeamMembers.workSchedule,
        employmentType: clientServiceTeamMembers.employmentType,
        isActive: clientServiceTeamMembers.isActive,
        startDate: clientServiceTeamMembers.startDate,
        endDate: clientServiceTeamMembers.endDate,
      })
      .from(clientServiceTeamMembers)
      .leftJoin(teamMembers, eq(clientServiceTeamMembers.teamMemberId, teamMembers.id))
      .leftJoin(clientServices, eq(clientServiceTeamMembers.clientServiceId, clientServices.id))
      .where(and(
        eq(clientServices.clientId, parseInt(clientId)),
        eq(clientServices.id, parseInt(serviceId))
      ))

    res.json(assignedDevelopers)
  } catch (error) {
    console.error('Error fetching service developers:', error)
    res.status(500).json({ error: 'Failed to fetch service developers' })
  }
})

// Add developer to client service
router.post('/clients/:clientId/services/:serviceId/developers', requireAuth, async (req, res) => {
  try {
    const { clientId, serviceId } = req.params
    const { teamMemberId, employmentType, hourlyRate, fixedPrice, startDate } = req.body
    console.log(`Adding developer ${teamMemberId} to client ${clientId}, service ${serviceId}`)

    if (!teamMemberId || !employmentType || !startDate) {
      return res.status(400).json({ error: 'Developer, employment type, and start date are required' })
    }

    if (!['fulltime', 'part_time', 'freelancer'].includes(employmentType)) {
      return res.status(400).json({ error: 'Employment type must be fulltime, part_time, or freelancer' })
    }

    // First verify that the client service exists
    const clientService = await db
      .select()
      .from(clientServices)
      .where(and(
        eq(clientServices.clientId, parseInt(clientId)),
        eq(clientServices.id, parseInt(serviceId))
      ))
      .limit(1)

    if (clientService.length === 0) {
      return res.status(404).json({ error: 'Client service not found' })
    }

    const [newAssignment] = await db
      .insert(clientServiceTeamMembers)
      .values({
        clientServiceId: parseInt(serviceId),
        teamMemberId: parseInt(teamMemberId),
        employmentType,
        hourlyRate: hourlyRate ? hourlyRate.toString() : null,
        fixedPrice: fixedPrice ? fixedPrice.toString() : null,
        startDate,
        isActive: true,
      })
      .returning()

    console.log('Developer assignment created successfully')
    res.status(201).json(newAssignment)
  } catch (error) {
    console.error('Error adding developer to service:', error)
    res.status(500).json({ error: 'Failed to add developer to service' })
  }
})

// Remove developer from client service
router.delete('/clients/:clientId/services/:serviceId/developers/:assignmentId', requireAuth, async (req, res) => {
  try {
    const { clientId, serviceId, assignmentId } = req.params
    const { permanent } = req.query
    console.log(`${permanent ? 'Permanently removing' : 'Deactivating'} developer assignment ${assignmentId}`)

    if (permanent === 'true') {
      const [deletedAssignment] = await db
        .delete(clientServiceTeamMembers)
        .where(eq(clientServiceTeamMembers.id, parseInt(assignmentId)))
        .returning()

      if (!deletedAssignment) {
        return res.status(404).json({ error: 'Developer assignment not found' })
      }

      console.log('Developer assignment permanently deleted')
      res.json({ message: 'Developer assignment permanently removed', assignment: deletedAssignment })
    } else {
      const [updatedAssignment] = await db
        .update(clientServiceTeamMembers)
        .set({
          isActive: false,
          endDate: new Date().toISOString().split('T')[0],
        })
        .where(eq(clientServiceTeamMembers.id, parseInt(assignmentId)))
        .returning()

      if (!updatedAssignment) {
        return res.status(404).json({ error: 'Developer assignment not found' })
      }

      console.log('Developer assignment deactivated successfully')
      res.json({ message: 'Developer assignment deactivated successfully', assignment: updatedAssignment })
    }
  } catch (error) {
    console.error('Error removing developer assignment:', error)
    res.status(500).json({ error: 'Failed to remove developer assignment' })
  }
})

// Update developer pricing and schedule for a service assignment
router.patch('/clients/:clientId/services/:serviceId/developers/:assignmentId', requireAuth, async (req, res) => {
  try {
    const { clientId, serviceId, assignmentId } = req.params
    const { hourlyRate, fixedPrice, workSchedule } = req.body
    console.log(`Updating developer assignment ${assignmentId}`)

    const updateData: any = {}
    if (hourlyRate !== undefined) updateData.hourlyRate = hourlyRate ? hourlyRate.toString() : null
    if (fixedPrice !== undefined) updateData.fixedPrice = fixedPrice ? fixedPrice.toString() : null
    if (workSchedule !== undefined) updateData.workSchedule = workSchedule

    const [updatedAssignment] = await db
      .update(clientServiceTeamMembers)
      .set(updateData)
      .where(eq(clientServiceTeamMembers.id, parseInt(assignmentId)))
      .returning()

    if (!updatedAssignment) {
      return res.status(404).json({ error: 'Developer assignment not found' })
    }

    console.log('Developer assignment updated successfully')
    res.json({ message: 'Developer assignment updated successfully', assignment: updatedAssignment })
  } catch (error) {
    console.error('Error updating developer assignment:', error)
    res.status(500).json({ error: 'Failed to update developer assignment' })
  }
})

// Update client service
router.put('/clients/:clientId/services/:serviceId', requireAuth, async (req, res) => {
  try {
    const { clientId, serviceId } = req.params
    const { rate, serviceLevelPrice, startDate, endDate, isActive } = req.body
    console.log(`Updating client service ${serviceId} for client ${clientId}`)

    const updateData: any = {}
    if (rate !== undefined) updateData.rate = rate ? rate.toString() : null
    if (serviceLevelPrice !== undefined) updateData.serviceLevelPrice = serviceLevelPrice ? serviceLevelPrice.toString() : null
    if (startDate !== undefined) updateData.startDate = startDate
    if (endDate !== undefined) updateData.endDate = endDate
    if (isActive !== undefined) updateData.isActive = isActive
    if (req.body.serviceTitle !== undefined) updateData.serviceTitle = req.body.serviceTitle
    if (req.body.slackChannelId !== undefined) updateData.slackChannelId = req.body.slackChannelId

    const [updatedService] = await db
      .update(clientServices)
      .set(updateData)
      .where(and(
        eq(clientServices.clientId, parseInt(clientId)),
        eq(clientServices.id, parseInt(serviceId))
      ))
      .returning()

    if (!updatedService) {
      return res.status(404).json({ error: 'Client service not found' })
    }

    console.log('Client service updated successfully')
    res.json(updatedService)
  } catch (error) {
    console.error('Error updating client service:', error)
    res.status(500).json({ error: 'Failed to update client service' })
  }
})

// Update service-level pricing (legacy endpoint)
router.put('/clients/:clientId/services/:serviceId/pricing', requireAuth, async (req, res) => {
  try {
    const { clientId, serviceId } = req.params
    const { serviceLevelPrice } = req.body
    console.log(`Updating service-level pricing for client ${clientId}, service ${serviceId}`)

    const [updatedService] = await db
      .update(clientServices)
      .set({
        serviceLevelPrice: serviceLevelPrice ? serviceLevelPrice.toString() : null,
      })
      .where(and(
        eq(clientServices.clientId, parseInt(clientId)),
        eq(clientServices.id, parseInt(serviceId))
      ))
      .returning()

    if (!updatedService) {
      return res.status(404).json({ error: 'Client service not found' })
    }

    console.log('Service-level pricing updated successfully')
    res.json(updatedService)
  } catch (error) {
    console.error('Error updating service pricing:', error)
    res.status(500).json({ error: 'Failed to update service pricing' })
  }
})

// Developer CRUD operations
// Update developer
router.put('/developers/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const { name, email, skills, hourlyRate, experienceLevel, status, bio, location } = req.body
    console.log('Updating developer:', id)

    const [updatedDeveloper] = await db
      .update(teamMembers)
      .set({
        name,
        email,
        skills: skills || [],
        hourlyRate: hourlyRate ? hourlyRate.toString() : null,
        status,
        updatedAt: new Date(),
      })
      .where(eq(teamMembers.id, parseInt(id)))
      .returning()

    if (!updatedDeveloper) {
      return res.status(404).json({ error: 'Developer not found' })
    }

    console.log('Developer updated successfully:', updatedDeveloper.name)
    res.json(updatedDeveloper)
  } catch (error: any) {
    console.error('Error updating developer:', error)
    if (error.code === '23505') { // Unique constraint violation
      return res.status(400).json({ error: 'A developer with this email already exists' })
    }
    res.status(500).json({ error: 'Failed to update developer' })
  }
})

// Delete developer
router.delete('/developers/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    console.log('Deleting developer:', id)

    // Check if developer is assigned to any active services
    const assignments = await db
      .select({ count: sql`count(*)` })
      .from(clientServiceTeamMembers)
      .where(and(
        eq(clientServiceTeamMembers.teamMemberId, parseInt(id)),
        eq(clientServiceTeamMembers.isActive, true)
      ))

    const assignmentCount = parseInt(assignments[0]?.count as string || '0')

    if (assignmentCount > 0) {
      return res.status(400).json({
        error: `Cannot delete developer who is currently assigned to ${assignmentCount} active service(s). Please remove all assignments first.`
      })
    }

    const [deletedDeveloper] = await db
      .delete(teamMembers)
      .where(eq(teamMembers.id, parseInt(id)))
      .returning()

    if (!deletedDeveloper) {
      return res.status(404).json({ error: 'Developer not found' })
    }

    console.log('Developer deleted successfully:', deletedDeveloper.name)
    res.json({ message: 'Developer deleted successfully', developer: deletedDeveloper })
  } catch (error) {
    console.error('Error deleting developer:', error)
    res.status(500).json({ error: 'Failed to delete developer' })
  }
})


export { router as servicesRouter }
