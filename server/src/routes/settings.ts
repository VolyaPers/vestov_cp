import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { integrationSettings } from '../db/schema.js'
import { requireAuth } from '../middleware/auth.js'
import { encrypt, decrypt } from '../lib/encryption.js'

const router = Router()
router.use(requireAuth)

function isAdmin(req: any, res: any): boolean {
  if (req.user!.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' })
    return false
  }
  return true
}

const VALID_PROVIDERS = ['stripe', 'payoneer']

// Mask a secret key for display
function maskSecret(value: string): string {
  if (!value || value.length <= 8) return '****'
  return value.slice(0, 4) + '****' + value.slice(-4)
}

// GET /integrations - List all providers with status
router.get('/integrations', async (req, res) => {
  if (!isAdmin(req, res)) return
  try {
    const rows = await db
      .select({
        id: integrationSettings.id,
        provider: integrationSettings.provider,
        isActive: integrationSettings.isActive,
        lastSyncAt: integrationSettings.lastSyncAt,
        createdAt: integrationSettings.createdAt,
        updatedAt: integrationSettings.updatedAt,
      })
      .from(integrationSettings)

    // Return all valid providers, marking which are configured
    const result = VALID_PROVIDERS.map((provider) => {
      const row = rows.find((r) => r.provider === provider)
      return {
        provider,
        isActive: row?.isActive ?? false,
        isConfigured: !!row,
        lastSyncAt: row?.lastSyncAt || null,
      }
    })

    res.json(result)
  } catch (error) {
    console.error('Get integrations error:', error)
    res.status(500).json({ error: 'Failed to fetch integrations' })
  }
})

// GET /integrations/:provider - Get provider config with masked credentials
router.get('/integrations/:provider', async (req, res) => {
  if (!isAdmin(req, res)) return
  const { provider } = req.params
  if (!VALID_PROVIDERS.includes(provider)) {
    return res.status(400).json({ error: 'Invalid provider' })
  }

  try {
    const [row] = await db
      .select()
      .from(integrationSettings)
      .where(eq(integrationSettings.provider, provider))

    if (!row || !row.credentials) {
      return res.json({ provider, isActive: false, isConfigured: false, credentials: {} })
    }

    let creds: Record<string, any> = {}
    try {
      creds = JSON.parse(decrypt(row.credentials))
    } catch {
      return res.json({ provider, isActive: false, isConfigured: false, credentials: {} })
    }

    // Mask all credential values
    const masked: Record<string, string> = {}
    for (const [key, value] of Object.entries(creds)) {
      masked[key] = typeof value === 'string' ? maskSecret(value) : String(value)
    }

    res.json({
      provider,
      isActive: row.isActive,
      isConfigured: true,
      lastSyncAt: row.lastSyncAt,
      credentials: masked,
    })
  } catch (error) {
    console.error('Get integration error:', error)
    res.status(500).json({ error: 'Failed to fetch integration' })
  }
})

// PUT /integrations/:provider - Save/update credentials
router.put('/integrations/:provider', async (req, res) => {
  if (!isAdmin(req, res)) return
  const { provider } = req.params
  if (!VALID_PROVIDERS.includes(provider)) {
    return res.status(400).json({ error: 'Invalid provider' })
  }

  const { credentials } = req.body
  if (!credentials || typeof credentials !== 'object') {
    return res.status(400).json({ error: 'Credentials object required' })
  }

  // Validate required fields per provider
  if (provider === 'stripe') {
    if (!credentials.secretKey) {
      return res.status(400).json({ error: 'Secret Key is required' })
    }
  } else if (provider === 'payoneer') {
    if (!credentials.clientId || !credentials.clientSecret || !credentials.programId) {
      return res.status(400).json({ error: 'Client ID, Client Secret, and Program ID are required' })
    }
  }

  try {
    const encrypted = encrypt(JSON.stringify(credentials))

    const [existing] = await db
      .select({ id: integrationSettings.id })
      .from(integrationSettings)
      .where(eq(integrationSettings.provider, provider))

    if (existing) {
      await db
        .update(integrationSettings)
        .set({
          credentials: encrypted,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(integrationSettings.provider, provider))
    } else {
      await db.insert(integrationSettings).values({
        provider,
        credentials: encrypted,
        isActive: true,
      })
    }

    res.json({ success: true, provider, isActive: true })
  } catch (error) {
    console.error('Save integration error:', error)
    res.status(500).json({ error: 'Failed to save integration' })
  }
})

// DELETE /integrations/:provider - Remove credentials
router.delete('/integrations/:provider', async (req, res) => {
  if (!isAdmin(req, res)) return
  const { provider } = req.params
  if (!VALID_PROVIDERS.includes(provider)) {
    return res.status(400).json({ error: 'Invalid provider' })
  }

  try {
    await db
      .update(integrationSettings)
      .set({
        credentials: '',
        isActive: false,
        lastSyncAt: null,
        updatedAt: new Date(),
      })
      .where(eq(integrationSettings.provider, provider))

    res.json({ success: true, provider, isActive: false })
  } catch (error) {
    console.error('Delete integration error:', error)
    res.status(500).json({ error: 'Failed to delete integration' })
  }
})

export { router as settingsRouter }
