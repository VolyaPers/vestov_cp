import https from 'node:https'

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

const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN
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
 * Fetch a user's avatar URL from Slack by their email address with improved reliability.
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
export async function getSlackAvatarByEmailImproved(
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
      getSlackAvatarByEmailImproved(email)
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
