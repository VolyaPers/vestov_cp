import express, { Router } from 'express'
import { and, eq, ne } from 'drizzle-orm'
import { db } from '../db/index.js'
import { clientServices } from '../db/schema.js'
import { requireAdmin, requireAuth } from '../middleware/auth.js'
import { clickupRequest, getClickUpCredentials } from '../services/clickup.js'
import {
  buildProjectReport,
  captureSlackRequest,
  getProjectByChannel,
  getProjectById,
  normalizeClickUpListInput,
  parseProjectCommand,
  resolveSlackRequestAction,
} from '../services/projectBot.js'
import {
  isProjectBotSlackConfigured,
  postSlackMessage,
  postSlackResponse,
  verifySlackRequest,
} from '../services/slackBot.js'

type RawBodyRequest = express.Request & { rawBody?: Buffer }

const router = Router()
const processedEventIds = new Map<string, number>()

const asyncRoute = (
  handler: (req: express.Request, res: express.Response) => Promise<unknown>,
) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
  void handler(req, res).catch(next)
}

function slackRequestIsValid(req: express.Request): boolean {
  return verifySlackRequest(
    (req as RawBodyRequest).rawBody,
    req.header('x-slack-request-timestamp'),
    req.header('x-slack-signature'),
  )
}

function rememberEvent(eventId: string | undefined): boolean {
  if (!eventId) return true
  const now = Date.now()
  for (const [id, seenAt] of processedEventIds) {
    if (now - seenAt > 10 * 60_000) processedEventIds.delete(id)
  }
  if (processedEventIds.has(eventId)) return false
  processedEventIds.set(eventId, now)
  return true
}

async function respondToSlashCommand(body: Record<string, string>): Promise<void> {
  const responseUrl = body.response_url
  if (!responseUrl) return
  try {
    const project = await getProjectByChannel(body.channel_id)
    if (!project) {
      await postSlackResponse(responseUrl, {
        response_type: 'ephemeral',
        text: 'No enabled project bot is configured for this Slack channel.',
      })
      return
    }
    const report = await buildProjectReport(project, parseProjectCommand(body.text || ''))
    await postSlackResponse(responseUrl, { response_type: 'ephemeral', text: report })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The project report could not be generated.'
    await postSlackResponse(responseUrl, { response_type: 'ephemeral', text: `⚠ ${message}` }).catch(() => undefined)
  }
}

router.post('/slack/commands', (req, res) => {
  if (!slackRequestIsValid(req)) return res.status(401).send('Invalid Slack signature')
  if (!isProjectBotSlackConfigured()) return res.json({ response_type: 'ephemeral', text: 'The project updates bot is currently disabled.' })
  const body = req.body as Record<string, string>
  res.json({ response_type: 'ephemeral', text: 'Checking ClickUp for the latest project status…' })
  void respondToSlashCommand(body)
})

router.post('/slack/events', (req, res) => {
  if (!slackRequestIsValid(req)) return res.status(401).send('Invalid Slack signature')
  const payload = req.body as Record<string, any>
  if (payload.type === 'url_verification') return res.type('text/plain').send(String(payload.challenge || ''))
  res.sendStatus(200)
  if (!isProjectBotSlackConfigured()) return
  if (!rememberEvent(payload.event_id)) return

  const event = payload.event as Record<string, any> | undefined
  if (!event || event.bot_id || event.subtype || !event.channel || !event.ts || !event.user || !event.text) return

  if (event.type === 'app_mention') {
    void (async () => {
      try {
        const project = await getProjectByChannel(event.channel)
        if (!project) return
        const report = await buildProjectReport(project, parseProjectCommand(event.text))
        await postSlackMessage({ channel: event.channel, thread_ts: event.thread_ts || event.ts, text: report })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'The project report could not be generated.'
        await postSlackMessage({ channel: event.channel, thread_ts: event.thread_ts || event.ts, text: `⚠ ${message}` }).catch(() => undefined)
      }
    })()
    return
  }

  if (event.type === 'message') {
    void captureSlackRequest({
      channel: event.channel,
      ts: event.ts,
      thread_ts: event.thread_ts,
      user: event.user,
      text: event.text,
    }).catch((error) => console.error('[PROJECT BOT] Slack request capture failed:', error))
  }
})

router.post('/slack/interactions', (req, res) => {
  if (!slackRequestIsValid(req)) return res.status(401).send('Invalid Slack signature')
  if (!isProjectBotSlackConfigured()) return res.json({ response_type: 'ephemeral', text: 'The project updates bot is currently disabled.' })
  let payload: Record<string, any>
  try {
    payload = typeof req.body?.payload === 'string' ? JSON.parse(req.body.payload) : req.body
  } catch {
    return res.status(400).send('Invalid interaction payload')
  }

  const action = payload.actions?.[0]
  const requestId = Number.parseInt(String(action?.value || ''), 10)
  const actionId = String(action?.action_id || '')
  const slackUserId = String(payload.user?.id || '')
  const responseUrl = String(payload.response_url || '')
  if (!Number.isFinite(requestId) || !actionId || !slackUserId) return res.status(400).send('Invalid project action')

  res.json({ response_type: 'ephemeral', text: 'Applying the confirmed project action…', replace_original: false })
  void (async () => {
    try {
      const result = await resolveSlackRequestAction(requestId, actionId, slackUserId)
      if (responseUrl) await postSlackResponse(responseUrl, { response_type: 'ephemeral', text: `✅ ${result}`, replace_original: false })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The action could not be completed.'
      if (responseUrl) await postSlackResponse(responseUrl, { response_type: 'ephemeral', text: `⚠ ${message}`, replace_original: false }).catch(() => undefined)
    }
  })()
})

router.get('/services/:id/config', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const projectId = Number.parseInt(req.params.id, 10)
  if (!Number.isFinite(projectId)) return res.status(400).json({ error: 'Invalid project ID' })
  const project = await getProjectById(projectId)
  if (!project) return res.status(404).json({ error: 'Project not found' })
  res.json({ ...project, slackAppConfigured: isProjectBotSlackConfigured() })
}))

router.put('/services/:id/config', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const projectId = Number.parseInt(req.params.id, 10)
  if (!Number.isFinite(projectId)) return res.status(400).json({ error: 'Invalid project ID' })

  const current = await getProjectById(projectId)
  if (!current) return res.status(404).json({ error: 'Project not found' })

  const slackChannelId = String(req.body?.slackChannelId ?? '').trim().toUpperCase() || null
  const clickupListId = normalizeClickUpListInput(String(req.body?.clickupListId ?? '')) || null
  const projectBotEnabled = req.body?.projectBotEnabled === true
  const projectBotDailyUpdateEnabled = req.body?.projectBotDailyUpdateEnabled !== false
  const projectBotDailyUpdateTime = String(req.body?.projectBotDailyUpdateTime ?? '09:00').trim()
  const projectBotTimezone = String(req.body?.projectBotTimezone ?? 'Europe/Kyiv').trim()
  const authorizedIds = Array.isArray(req.body?.projectBotAuthorizedSlackUserIds)
    ? Array.from(new Set(req.body.projectBotAuthorizedSlackUserIds.map((value: unknown) => String(value).trim().toUpperCase()).filter(Boolean))) as string[]
    : []

  if (slackChannelId && !/^[CG][A-Z0-9]+$/i.test(slackChannelId)) {
    return res.status(400).json({ error: 'Slack Channel ID must look like C0123456789 or G0123456789.' })
  }
  if (clickupListId && !/^\d+$/.test(clickupListId)) {
    return res.status(400).json({
      error: 'Use a numeric ClickUp List ID. Vestov Hub also accepts List URLs containing /v/li/NUMBER or /v/l/6-NUMBER-1.',
    })
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(projectBotDailyUpdateTime)) {
    return res.status(400).json({ error: 'Daily update time must use 24-hour HH:mm format.' })
  }
  if (authorizedIds.some((id) => !/^U[A-Z0-9]+$/i.test(id))) {
    return res.status(400).json({ error: 'Authorized Slack user IDs must look like U0123456789.' })
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone: projectBotTimezone }).format()
  } catch {
    return res.status(400).json({ error: 'Project bot timezone must be a valid IANA timezone, such as Europe/Kyiv.' })
  }
  if (projectBotEnabled && (!slackChannelId || !clickupListId)) {
    return res.status(400).json({ error: 'An enabled project bot requires both a Slack channel and a ClickUp List.' })
  }

  if (projectBotEnabled && slackChannelId) {
    const [duplicate] = await db
      .select({ id: clientServices.id })
      .from(clientServices)
      .where(and(
        eq(clientServices.slackChannelId, slackChannelId),
        eq(clientServices.projectBotEnabled, true),
        ne(clientServices.id, projectId),
      ))
      .limit(1)
    if (duplicate) return res.status(409).json({ error: 'That Slack channel is already assigned to another enabled project bot.' })
  }

  let clickupListName: string | null = null
  if (clickupListId) {
    const credentials = await getClickUpCredentials()
    if (!credentials) return res.status(400).json({ error: 'Connect ClickUp before assigning a project List.' })
    try {
      const list = await clickupRequest<{ id: string; name: string }>(`/list/${encodeURIComponent(clickupListId)}`, credentials.apiToken)
      clickupListName = list.name
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ClickUp List could not be accessed.'
      return res.status(400).json({ error: message })
    }
  }

  await db
    .update(clientServices)
    .set({
      slackChannelId,
      clickupListId,
      clickupListName,
      projectBotEnabled,
      projectBotDailyUpdateEnabled,
      projectBotDailyUpdateTime,
      projectBotTimezone,
      projectBotAuthorizedSlackUserIds: authorizedIds,
    })
    .where(eq(clientServices.id, projectId))

  const project = await getProjectById(projectId)
  res.json({
    ...project,
    slackAppConfigured: isProjectBotSlackConfigured(),
    warning: authorizedIds.length === 0
      ? 'Reports are available, but request linking and dismissal remain disabled until authorized Slack user IDs are added.'
      : !isProjectBotSlackConfigured()
        ? 'Project saved, but PROJECT_BOT_ENABLED, SLACK_BOT_TOKEN, and SLACK_SIGNING_SECRET must be configured on the server.'
        : null,
  })
}))

export { router as projectBotRouter }
