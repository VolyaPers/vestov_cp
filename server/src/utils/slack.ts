import https from 'node:https'

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
  timestamp?: Date
}

export async function notifyShiftEvent(options: NotifyShiftEventOptions) {
  if (!isConfigured()) return

  const {
    event,
    employeeName,
    employeeEmail,
    shiftId,
    breakType,
    breakNote
  } = options

  const actor = employeeName || employeeEmail
  const note = breakNote?.trim()

  const textByEvent: Record<ShiftEvent, string> = {
    shift_started: `🚀 ${actor} Started the Shift`,
    shift_ended: `🏁 ${actor} Ended the Shift`,
    break_started: `☕ ${actor} On Break${note ? ` | Note: ${note}` : ''}`,
    break_ended: `↩️ ${actor} Ended the Break`
  }

  if (!SLACK_CHANNEL) {
    console.warn('[SLACK] SLACK_CHANNEL_ID not configured')
    return
  }

  await postToSlack({
    text: textByEvent[event],
    channel: SLACK_CHANNEL
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

  const text = `🏖️ New Vacation Request from ${actor}`

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '🏖️ New Vacation Request'
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

