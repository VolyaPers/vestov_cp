import { Router } from 'express'
import { requireAdmin, requireAuth } from '../middleware/auth.js'
import {
  getClickUpComplianceOverview,
  getClickUpStatus,
  getClickUpTimeEntries,
  getClickUpTimeReport,
  listClickUpMemberMappings,
  listClickUpMembers,
  listClickUpWorkspaces,
  replaceClickUpMemberMappings,
  syncClickUpTimeEntries,
} from '../services/clickup.js'

const router = Router()

router.use(requireAuth, requireAdmin)

function parseOptionalNumber(value: unknown): number | undefined {
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? undefined : parsed
}

router.get('/status', async (_req, res) => {
  try {
    const status = await getClickUpStatus()
    res.json(status)
  } catch (error) {
    console.error('ClickUp status error:', error)
    res.status(500).json({ error: 'Failed to load ClickUp status' })
  }
})

router.get('/compliance', async (req, res) => {
  try {
    const rangePreset = req.query.rangePreset === 'last_week'
      || req.query.rangePreset === 'today'
      || req.query.rangePreset === 'yesterday'
      || req.query.rangePreset === 'this_week'
      || req.query.rangePreset === 'this_month'
      || req.query.rangePreset === 'last_month'
      || req.query.rangePreset === 'last_quarter'
      || req.query.rangePreset === 'last_year'
      || req.query.rangePreset === 'custom'
      ? req.query.rangePreset
      : undefined

    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined

    const compliance = await getClickUpComplianceOverview({
      rangePreset,
      startDate,
      endDate,
    })
    res.json(compliance)
  } catch (error) {
    console.error('ClickUp compliance error:', error)
    res.status(500).json({ error: 'Failed to load ClickUp compliance summary' })
  }
})

router.get('/members', async (_req, res) => {
  try {
    const members = await listClickUpMembers()
    res.json(members)
  } catch (error) {
    console.error('ClickUp members error:', error)
    res.status(500).json({ error: 'Failed to load ClickUp members' })
  }
})

router.post('/validate', async (req, res) => {
  try {
    const apiToken = String(req.body?.apiToken ?? '').trim()
    if (!apiToken) {
      return res.status(400).json({ error: 'API token is required' })
    }

    const workspaces = await listClickUpWorkspaces(apiToken)
    res.json({ workspaces })
  } catch (error) {
    console.error('ClickUp validate error:', error)
    const message = error instanceof Error ? error.message : 'Failed to validate ClickUp token'
    res.status(400).json({ error: message })
  }
})

router.get('/member-mappings', async (_req, res) => {
  try {
    const mappings = await listClickUpMemberMappings()
    res.json(mappings)
  } catch (error) {
    console.error('ClickUp mappings error:', error)
    res.status(500).json({ error: 'Failed to load ClickUp member mappings' })
  }
})

router.put('/member-mappings', async (req, res) => {
  try {
    const mappings = Array.isArray(req.body?.mappings) ? req.body.mappings : null
    if (!mappings) {
      return res.status(400).json({ error: 'Mappings array is required' })
    }

    const normalizedMappings = mappings.flatMap((mapping: Record<string, unknown>) => {
      const teamMemberId = typeof mapping.teamMemberId === 'number'
        ? mapping.teamMemberId
        : Number.parseInt(String(mapping.teamMemberId ?? ''), 10)

      const clickupUserId = String(mapping.clickupUserId ?? '').trim()
      const clickupUserName = String(mapping.clickupUserName ?? '').trim()
      const clickupUserEmail = String(mapping.clickupUserEmail ?? '').trim()

      if (!Number.isFinite(teamMemberId) || !clickupUserId || !clickupUserName) {
        return []
      }

      return [{
        teamMemberId,
        clickupUserId,
        clickupUserName,
        clickupUserEmail: clickupUserEmail || null,
      }]
    })

    const hasDuplicates = new Set(normalizedMappings.map((mapping) => mapping.teamMemberId)).size !== normalizedMappings.length
      || new Set(normalizedMappings.map((mapping) => mapping.clickupUserId)).size !== normalizedMappings.length

    if (hasDuplicates) {
      return res.status(400).json({ error: 'Each Vestov team member and ClickUp user can only be mapped once.' })
    }

    const savedMappings = await replaceClickUpMemberMappings(normalizedMappings, req.user!.id)
    res.json(savedMappings)
  } catch (error) {
    console.error('Save ClickUp mappings error:', error)
    const message = error instanceof Error ? error.message : 'Failed to save ClickUp member mappings'
    res.status(500).json({ error: message })
  }
})

router.post('/sync', async (req, res) => {
  try {
    const result = await syncClickUpTimeEntries('manual', req.user!.id)
    res.json({ success: true, ...result })
  } catch (error) {
    console.error('ClickUp sync error:', error)
    const message = error instanceof Error ? error.message : 'Failed to sync ClickUp time entries'
    const statusCode = message.includes('already running') ? 409 : 500
    res.status(statusCode).json({ error: message })
  }
})

router.get('/time-report', async (req, res) => {
  try {
    const report = await getClickUpTimeReport({
      startDate: typeof req.query.startDate === 'string' ? req.query.startDate : undefined,
      endDate: typeof req.query.endDate === 'string' ? req.query.endDate : undefined,
      teamMemberId: parseOptionalNumber(req.query.teamMemberId),
      clientId: parseOptionalNumber(req.query.clientId),
      clientServiceId: parseOptionalNumber(req.query.clientServiceId),
      attributionStatus: req.query.attributionStatus === 'assigned' || req.query.attributionStatus === 'unassigned'
        ? req.query.attributionStatus
        : undefined,
    })
    res.json(report)
  } catch (error) {
    console.error('ClickUp report error:', error)
    res.status(500).json({ error: 'Failed to load ClickUp time report' })
  }
})

router.get('/time-entries', async (req, res) => {
  try {
    const entries = await getClickUpTimeEntries({
      startDate: typeof req.query.startDate === 'string' ? req.query.startDate : undefined,
      endDate: typeof req.query.endDate === 'string' ? req.query.endDate : undefined,
      teamMemberId: parseOptionalNumber(req.query.teamMemberId),
      clientId: parseOptionalNumber(req.query.clientId),
      clientServiceId: parseOptionalNumber(req.query.clientServiceId),
      attributionStatus: req.query.attributionStatus === 'assigned' || req.query.attributionStatus === 'unassigned'
        ? req.query.attributionStatus
        : undefined,
      page: parseOptionalNumber(req.query.page),
      pageSize: parseOptionalNumber(req.query.pageSize),
    })
    res.json(entries)
  } catch (error) {
    console.error('ClickUp entries error:', error)
    res.status(500).json({ error: 'Failed to load ClickUp time entries' })
  }
})

export { router as clickupRouter }
