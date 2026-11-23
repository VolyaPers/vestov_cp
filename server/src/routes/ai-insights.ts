import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { requireAdmin } from '../middleware/auth.js'
import { generateInsights, generateScenario } from '../services/aiInsights.js'

export const aiInsightsRouter = Router()

const insightsLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI insight requests. Please wait a few minutes.' },
})

let cachedInsights: { data: any; expiresAt: number } | null = null
const CACHE_TTL = 10 * 60 * 1000

aiInsightsRouter.get('/', requireAdmin, insightsLimiter, async (_req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      res.status(503).json({ error: 'AI insights are not configured. Set ANTHROPIC_API_KEY in your environment.' })
      return
    }

    if (cachedInsights && cachedInsights.expiresAt > Date.now()) {
      res.json(cachedInsights.data)
      return
    }

    const insights = await generateInsights()
    cachedInsights = { data: insights, expiresAt: Date.now() + CACHE_TTL }
    res.json(insights)
  } catch (error) {
    console.error('[AI Insights] Generation failed:', error)
    const message = error instanceof Error ? error.message : 'Failed to generate AI insights'
    res.status(500).json({ error: message })
  }
})

aiInsightsRouter.post('/refresh', requireAdmin, insightsLimiter, async (_req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      res.status(503).json({ error: 'AI insights are not configured. Set ANTHROPIC_API_KEY in your environment.' })
      return
    }

    const insights = await generateInsights()
    cachedInsights = { data: insights, expiresAt: Date.now() + CACHE_TTL }
    res.json(insights)
  } catch (error) {
    console.error('[AI Insights] Refresh failed:', error)
    const message = error instanceof Error ? error.message : 'Failed to refresh AI insights'
    res.status(500).json({ error: message })
  }
})

aiInsightsRouter.post('/scenario', requireAdmin, insightsLimiter, async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      res.status(503).json({ error: 'AI insights are not configured. Set ANTHROPIC_API_KEY in your environment.' })
      return
    }

    const { question } = req.body
    if (!question || typeof question !== 'string' || question.trim().length < 10 || question.length > 500) {
      res.status(400).json({ error: 'Provide a scenario question between 10 and 500 characters.' })
      return
    }

    const result = await generateScenario(question.trim())
    res.json(result)
  } catch (error) {
    console.error('[AI Insights] Scenario failed:', error)
    const message = error instanceof Error ? error.message : 'Failed to analyze scenario'
    res.status(500).json({ error: message })
  }
})
