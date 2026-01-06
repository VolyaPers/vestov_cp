import https from 'node:https'

interface SlackPayload {
  text: string
  channel: string
}

const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN
const SLACK_CHANNEL = process.env.SLACK_CHANNEL_ID
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

  await postToSlack({
    text: textByEvent[event],
    channel: SLACK_CHANNEL as string
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

