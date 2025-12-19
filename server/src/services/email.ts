interface EmailPayload {
  to: string
  subject: string
  html?: string
  text?: string
}

const EMAIL_WEBHOOK =
  process.env.INVITE_EMAIL_WEBHOOK_URL ||
  process.env.EMAIL_WEBHOOK_URL ||
  process.env.RESEND_WEBHOOK_URL

const APP_BASE_URL = process.env.PUBLIC_APP_URL || 'http://localhost:5173'

export async function sendEmail(payload: EmailPayload) {
  if (!EMAIL_WEBHOOK) {
    console.warn('[email] EMAIL_WEBHOOK_URL not configured, skipping send')
    return { delivered: false, skipped: true }
  }

  const response = await fetch(EMAIL_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(
      `Failed to send email (status ${response.status}): ${body || response.statusText}`
    )
  }

  return { delivered: true }
}

export function buildInviteEmail(token: string, email: string) {
  const inviteUrl = `${APP_BASE_URL}?mode=invite&token=${encodeURIComponent(token)}`
  const subject = 'You have been invited to the Vestov portal'
  const text = [
    'You have been added to the Vestov platform.',
    'To finish setting up your account, create a password using the link below (expires in 72 hours):',
    inviteUrl,
    '',
    'If you did not expect this invitation, you can ignore this email.',
  ].join('\n')

  const html = `
    <p>Hello,</p>
    <p>You have been added to the Vestov platform.</p>
    <p>To finish setting up your account, create a password using the link below (expires in 72 hours):</p>
    <p><a href="${inviteUrl}" target="_blank" rel="noopener noreferrer">${inviteUrl}</a></p>
    <p>If you did not expect this invitation, you can ignore this email.</p>
  `

  return { inviteUrl, subject, html, text, to: email }
}

