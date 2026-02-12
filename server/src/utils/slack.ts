import https from 'node:https'

// Slack User Profile types
interface SlackUserProfile {
  image_24?: string
  image_32?: string
  image_48?: string
  image_72?: string
  image_192?: string
  image_512?: string
  image_1024?: string
  image_original?: string
}

interface SlackUser {
  id: string
  name: string
  profile: SlackUserProfile
}

interface SlackLookupResponse {
  ok: boolean
  user?: SlackUser
  error?: string
}

// Slack Block Kit types
interface SlackTextBlock {
  type: 'plain_text' | 'mrkdwn'
  text: string
}

interface SlackHeaderBlock {
  type: 'header'
  text: SlackTextBlock
}

interface SlackField {
  type: 'mrkdwn'
  text: string
}

interface SlackSectionBlock {
  type: 'section'
  text?: SlackTextBlock
  fields?: SlackField[]
}

interface SlackButtonElement {
  type: 'button'
  text: SlackTextBlock
  url: string
  style?: 'primary' | 'danger'
}

interface SlackActionsBlock {
  type: 'actions'
  elements: SlackButtonElement[]
}

type SlackBlock = SlackHeaderBlock | SlackSectionBlock | SlackActionsBlock

interface SlackPayload {
  text?: string
  channel: string
  blocks?: SlackBlock[]
}

const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN
const SLACK_CHANNEL = process.env.SLACK_CHANNEL_ID
const SLACK_ADMIN_CHANNEL = process.env.SLACK_ADMIN_CHANNEL_ID || process.env.SLACK_CHANNEL_ID
const SLACK_ENABLED = process.env.SLACK_NOTIFICATIONS_ENABLED === 'true'

const isConfigured = () => SLACK_ENABLED && !!SLACK_TOKEN && !!SLACK_CHANNEL

function postToSlack(payload: SlackPayload) {
  return new Promise<void>((resolve) => {
    if (!isConfigured()) {
      return resolve()
    }

    const data = JSON.stringify(payload)
    const req = https.request(
      {
        hostname: 'slack.com',
        path: '/api/chat.postMessage',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': Buffer.byteLength(data),
          Authorization: `Bearer ${SLACK_TOKEN}`
        }
      },
      async (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString()
          try {
            const parsed = JSON.parse(body)
            if (!parsed.ok) {
              console.error('[SLACK] postMessage error:', parsed.error || body)
            }
          } catch {
            if (res.statusCode && res.statusCode >= 300) {
              console.error('[SLACK] postMessage non-OK:', res.statusCode, body)
            }
          }
          resolve()
        })
      }
    )

    req.on('error', (err) => {
      console.error('[SLACK] postMessage failed:', err)
      resolve()
    })

    req.write(data)
    req.end()
  })
}

type ShiftEvent =
  | 'shift_started'
  | 'shift_ended'
  | 'break_started'
  | 'break_ended'

interface NotifyShiftEventOptions {
  event: ShiftEvent
  employeeName?: string | null
  employeeEmail: string
  shiftId?: number | null
  breakType?: string | null
  breakNote?: string | null
  comment?: string | null
  timestamp?: Date
  channelId?: string // Optional: service-specific Slack channel ID
}

export async function notifyShiftEvent(options: NotifyShiftEventOptions) {
  if (!isConfigured()) return

  const {
    event,
    employeeName,
    employeeEmail,
    shiftId,
    breakType,
    breakNote,
    comment,
    channelId // Extract channelId from options
  } = options

  const actor = employeeName || employeeEmail
  const note = (breakNote || comment)?.trim()

  const textByEvent: Record<ShiftEvent, string> = {
    shift_started: `🚀 ${actor} Started the Shift${comment?.trim() ? ` | 💬 ${comment.trim()}` : ''}`,
    shift_ended: `🏁 ${actor} Ended the Shift`,
    break_started: `☕ ${actor} On Break${note ? ` | 💬 ${note}` : ''}`,
    break_ended: `↩️ ${actor} Ended the Break`
  }

  // Use provided channelId, fallback to default SLACK_CHANNEL
  const targetChannel = channelId || SLACK_CHANNEL

  if (!targetChannel) {
    console.warn('[SLACK] No channel configured for notification')
    return
  }

  await postToSlack({
    text: textByEvent[event],
    channel: targetChannel
  })
}

function formatTimestamp(date: Date) {
  const local = date.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })

  const cleaned = local.replace(/,/g, '')
  const parts = cleaned.split(' ')
  if (parts.length >= 2) {
    return `${parts[0]} - ${parts[1]}`
  }
  return cleaned
}

function getFrontendUrl(): string {
  return process.env.FRONTEND_URL || process.env.PUBLIC_APP_URL || 'http://localhost:5173'
}

interface NotifyReimbursementRequestOptions {
  employeeName?: string | null
  employeeEmail: string
  requestId: number
  description: string
  amount: string
}

export async function notifyReimbursementRequest(options: NotifyReimbursementRequestOptions) {
  if (!isConfigured()) return

  if (!SLACK_ADMIN_CHANNEL) {
    console.warn('[SLACK] SLACK_ADMIN_CHANNEL_ID not configured, falling back to SLACK_CHANNEL_ID')
  }

  const { employeeName, employeeEmail, requestId, description, amount } = options
  const actor = employeeName || employeeEmail
  const frontendUrl = getFrontendUrl()
  const adminUrl = `${frontendUrl}/admin/reimbursements`

  const text = `💰 New Reimbursement Request from ${actor}`

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '💰 New Reimbursement Request'
      }
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*👤 Employee:*\n${actor}`
        },
        {
          type: 'mrkdwn',
          text: `*💵 Amount:*\n$${amount}`
        }
      ]
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*📝 Description:*\n${description}`
      }
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Review in Portal'
          },
          url: adminUrl,
          style: 'primary'
        }
      ]
    }
  ]

  await postToSlack({
    text,
    channel: SLACK_ADMIN_CHANNEL || SLACK_CHANNEL || '',
    blocks
  })
}

interface NotifyVacationRequestOptions {
  employeeName?: string | null
  employeeEmail: string
  requestId: number
  leaveTypeName: string
  startDate: string
  endDate: string
  daysCount: string
  reason?: string | null
}

export async function notifyVacationRequest(options: NotifyVacationRequestOptions) {
  if (!isConfigured()) return

  if (!SLACK_ADMIN_CHANNEL) {
    console.warn('[SLACK] SLACK_ADMIN_CHANNEL_ID not configured, falling back to SLACK_CHANNEL_ID')
  }

  const { employeeName, employeeEmail, requestId, leaveTypeName, startDate, endDate, daysCount, reason } = options
  const actor = employeeName || employeeEmail
  const frontendUrl = getFrontendUrl()
  const adminUrl = `${frontendUrl}/admin/vacation`

  const startDateFormatted = new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const endDateFormatted = new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  const isSickLeave = /sick/i.test(leaveTypeName)
  const emoji = isSickLeave ? '🏥' : '🏖️'
  const requestLabel = isSickLeave ? 'Sick Leave Request' : 'Vacation Request'

  const text = `${emoji} New ${requestLabel} from ${actor}`

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${emoji} New ${requestLabel}`
      }
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*👤 Employee:*\n${actor}`
        },
        {
          type: 'mrkdwn',
          text: `*📅 Type:*\n${leaveTypeName}`
        },
        {
          type: 'mrkdwn',
          text: `*📆 Period:*\n${startDateFormatted} to ${endDateFormatted}`
        },
        {
          type: 'mrkdwn',
          text: `*⏱️ Days:*\n${daysCount}`
        }
      ]
    }
  ]

  if (reason) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*📄 Reason:*\n${reason}`
      }
    })
  }

  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'Review in Portal'
        },
        url: adminUrl,
        style: 'primary'
      }
    ]
  })

  await postToSlack({
    text,
    channel: SLACK_ADMIN_CHANNEL || SLACK_CHANNEL || '',
    blocks
  })
}

const SLACK_API_TIMEOUT = 10000 // 10 seconds
const MAX_RETRIES = 3
const RETRY_DELAY = 1000 // 1 second

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Make a single request to Slack API with timeout
 */
function makeSlackRequest(
  email: string,
  timeout: number
): Promise<{
  avatar72?: string
  avatar192?: string
  avatar512?: string
  slackUserId?: string
} | null> {
  return new Promise((resolve, reject) => {
    const encodedEmail = encodeURIComponent(email)

    const req = https.request(
      {
        hostname: 'slack.com',
        path: `/api/users.lookupByEmail?email=${encodedEmail}`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${SLACK_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout
      },
      (res) => {
        const chunks: Buffer[] = []

        res.on('data', (chunk) => chunks.push(chunk))

        res.on('end', () => {
          const body = Buffer.concat(chunks).toString()

          try {
            const parsed: SlackLookupResponse = JSON.parse(body)

            if (!parsed.ok) {
              if (parsed.error === 'users_not_found') {
                console.log(`[SLACK] User not found for email: ${email}`)
                return resolve(null)
              }

              if (parsed.error === 'rate_limited') {
                return reject(new Error('rate_limited'))
              }

              console.error('[SLACK] lookupByEmail error:', parsed.error)
              return reject(new Error(parsed.error || 'Unknown Slack API error'))
            }

            if (parsed.user?.profile) {
              resolve({
                avatar72: parsed.user.profile.image_72,
                avatar192: parsed.user.profile.image_192,
                avatar512: parsed.user.profile.image_512,
                slackUserId: parsed.user.id
              })
            } else {
              resolve(null)
            }
          } catch (err) {
            console.error('[SLACK] Failed to parse response:', err)
            reject(new Error('Failed to parse Slack API response'))
          }
        })
      }
    )

    // Handle request timeout
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })

    // Handle request errors
    req.on('error', (err) => {
      reject(err)
    })

    req.end()
  })
}

/**
 * Fetch a user's avatar URL from Slack by their email address with improved reliability.
 * Requires the `users:read.email` scope on the Slack bot.
 *
 * Improvements:
 * - Request timeout (10s)
 * - Retry logic (3 attempts with exponential backoff)
 * - Better error handling and logging
 * - Rate limit detection
 *
 * @param email - The email address to look up
 * @param options - Optional configuration
 * @returns Object with avatar URLs of different sizes, or null if not found
 */
export async function getSlackAvatarByEmail(
  email: string,
  options: {
    maxRetries?: number
    timeout?: number
    retryDelay?: number
  } = {}
): Promise<{
  avatar72?: string
  avatar192?: string
  avatar512?: string
  slackUserId?: string
} | null> {
  if (!SLACK_TOKEN) {
    console.warn('[SLACK] SLACK_BOT_TOKEN not configured')
    return null
  }

  const maxRetries = options.maxRetries ?? MAX_RETRIES
  const timeout = options.timeout ?? SLACK_API_TIMEOUT
  const baseRetryDelay = options.retryDelay ?? RETRY_DELAY

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 1s, 2s, 4s
      const delay = baseRetryDelay * Math.pow(2, attempt - 1)
      console.log(`[SLACK] Retry attempt ${attempt}/${maxRetries} for ${email} after ${delay}ms`)
      await sleep(delay)
    }

    try {
      const result = await makeSlackRequest(email, timeout)

      // Success!
      if (result) {
        if (attempt > 0) {
          console.log(`[SLACK] Successfully fetched avatar for ${email} after ${attempt} retries`)
        }
        return result
      }

      // User not found (not an error, just doesn't exist)
      return null

    } catch (error) {
      lastError = error as Error

      // Check if it's a rate limit error - wait longer
      if (lastError.message.includes('rate_limited')) {
        console.warn(`[SLACK] Rate limited when fetching ${email}, waiting 5s...`)
        await sleep(5000)
        continue
      }

      // Check if it's a timeout - retry
      if (lastError.message.includes('timeout') || lastError.message.includes('ETIMEDOUT')) {
        console.warn(`[SLACK] Timeout fetching avatar for ${email}, attempt ${attempt + 1}/${maxRetries + 1}`)
        continue
      }

      // For other errors, log and retry
      console.error(`[SLACK] Error fetching avatar for ${email} (attempt ${attempt + 1}):`, lastError.message)
    }
  }

  // All retries exhausted
  console.error(`[SLACK] Failed to fetch avatar for ${email} after ${maxRetries} retries:`, lastError?.message)
  return null
}

/**
 * Batch fetch avatars for multiple emails with concurrency control
 * to avoid overwhelming the Slack API
 */
export async function batchGetSlackAvatars(
  emails: string[],
  options: {
    concurrency?: number
    onProgress?: (completed: number, total: number) => void
  } = {}
): Promise<Map<string, {
  avatar72?: string
  avatar192?: string
  avatar512?: string
  slackUserId?: string
} | null>> {
  const concurrency = options.concurrency ?? 3 // Max 3 concurrent requests
  const results = new Map<string, any>()

  // Process in batches
  for (let i = 0; i < emails.length; i += concurrency) {
    const batch = emails.slice(i, i + concurrency)
    const promises = batch.map(email =>
      getSlackAvatarByEmail(email)
        .then(result => ({ email, result }))
        .catch(error => ({ email, result: null, error }))
    )

    const batchResults = await Promise.all(promises)

    for (const { email, result } of batchResults) {
      results.set(email, result)
    }

    if (options.onProgress) {
      options.onProgress(Math.min(i + concurrency, emails.length), emails.length)
    }
  }

  return results
}

