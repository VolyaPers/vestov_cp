import crypto from 'node:crypto'

type SlackApiResponse = {
  ok: boolean
  error?: string
  [key: string]: unknown
}

export type SlackMessagePayload = {
  channel: string
  text: string
  blocks?: unknown[]
  thread_ts?: string
  unfurl_links?: boolean
  unfurl_media?: boolean
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function isProjectBotSlackConfigured(): boolean {
  return process.env.PROJECT_BOT_ENABLED === 'true'
    && Boolean(process.env.SLACK_BOT_TOKEN)
    && Boolean(process.env.SLACK_SIGNING_SECRET)
}

export function verifySlackRequest(rawBody: Buffer | undefined, timestampHeader: string | undefined, signature: string | undefined): boolean {
  const signingSecret = process.env.SLACK_SIGNING_SECRET
  if (!signingSecret || !rawBody || !timestampHeader || !signature) {
    return false
  }

  const timestamp = Number.parseInt(timestampHeader, 10)
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 60 * 5) {
    return false
  }

  const base = `v0:${timestampHeader}:${rawBody.toString('utf8')}`
  const expected = `v0=${crypto.createHmac('sha256', signingSecret).update(base).digest('hex')}`
  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)

  return actualBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(actualBuffer, expectedBuffer)
}

async function slackApiRequest<T extends SlackApiResponse>(method: string, body: Record<string, unknown>, attempt = 0): Promise<T> {
  const token = process.env.SLACK_BOT_TOKEN
  if (!token) {
    throw new Error('SLACK_BOT_TOKEN is not configured')
  }

  const response = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  })

  if (response.status === 429 && attempt < 2) {
    const retryAfter = Number.parseInt(response.headers.get('retry-after') ?? '', 10)
    const waitMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : (attempt === 0 ? 30_000 : 60_000)
    await sleep(waitMs)
    return slackApiRequest<T>(method, body, attempt + 1)
  }

  const payload = await response.json() as T
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || `Slack API error: ${response.status}`)
  }

  return payload
}

export async function postSlackMessage(payload: SlackMessagePayload): Promise<void> {
  await slackApiRequest('chat.postMessage', {
    ...payload,
    unfurl_links: payload.unfurl_links ?? false,
    unfurl_media: payload.unfurl_media ?? false,
  })
}

export async function postSlackResponse(
  responseUrl: string,
  payload: { text: string; blocks?: unknown[]; response_type?: 'ephemeral' | 'in_channel'; replace_original?: boolean },
): Promise<void> {
  const response = await fetch(responseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`Slack response URL error: ${response.status}`)
  }
}
