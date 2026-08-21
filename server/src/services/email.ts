interface EmailPayload {
  to: string
  subject: string
  html?: string
  text?: string
}

interface SalaryBreakdownItem {
  label: string
  amount: number
}

interface SalaryPaymentEmailPayload {
  to: string
  employeeName: string
  salaryMonth: string
  paymentDate: string
  baseSalary: number
  salaryPaidNow: number
  remainingSalary: number
  extras: SalaryBreakdownItem[]
  totalPayout: number
  note?: string
  description?: string | null
}

interface ReimbursementRequestEmailPayload {
  to: string
  employeeName?: string | null
  employeeEmail?: string | null
  requestId: number
  description: string
  category?: string | null
  expenseAmount: number | string
  reimbursementAmount: number | string
  year: number
}

interface VacationRequestEmailPayload {
  to: string
  employeeName?: string | null
  employeeEmail?: string | null
  requestId: number
  leaveTypeName: string
  startDate: string
  endDate: string
  daysCount: number | string
  reason?: string | null
}

const EMAIL_WEBHOOK =
  process.env.INVITE_EMAIL_WEBHOOK_URL ||
  process.env.EMAIL_WEBHOOK_URL ||
  process.env.RESEND_WEBHOOK_URL
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || process.env.SENDGRID_FROM
const SENDGRID_FROM_NAME = process.env.SENDGRID_FROM_NAME || 'Vestov Hub'
const SENDGRID_REPLY_TO_EMAIL = process.env.SENDGRID_REPLY_TO_EMAIL

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN
const MAILGUN_BASE_URL = (process.env.MAILGUN_BASE_URL || 'https://api.mailgun.net').replace(/\/$/, '')
const MAILGUN_FROM =
  process.env.MAILGUN_FROM ||
  (MAILGUN_DOMAIN ? `${SENDGRID_FROM_NAME} <postmaster@${MAILGUN_DOMAIN}>` : undefined)

const APP_BASE_URL = process.env.PUBLIC_APP_URL || 'http://localhost:5173'
export const REQUEST_NOTIFICATION_EMAIL = process.env.REQUEST_NOTIFICATION_EMAIL || 'v@vestov.com'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatSalaryMonth(value: string) {
  const [year, month] = value.split('-').map(Number)
  if (!year || !month) return value
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

function formatPaymentDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatRequestDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export async function sendEmail(payload: EmailPayload) {
  if (SENDGRID_API_KEY && SENDGRID_FROM_EMAIL) {
    const content = []
    if (payload.text) {
      content.push({ type: 'text/plain', value: payload.text })
    }
    if (payload.html) {
      content.push({ type: 'text/html', value: payload.html })
    }
    if (content.length === 0) {
      content.push({ type: 'text/plain', value: '' })
    }

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: payload.to }],
          },
        ],
        from: {
          email: SENDGRID_FROM_EMAIL,
          name: SENDGRID_FROM_NAME,
        },
        reply_to: SENDGRID_REPLY_TO_EMAIL
          ? { email: SENDGRID_REPLY_TO_EMAIL, name: SENDGRID_FROM_NAME }
          : undefined,
        subject: payload.subject,
        content,
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(
        `Failed to send SendGrid email (status ${response.status}): ${body || response.statusText}`
      )
    }

    return { delivered: true, provider: 'sendgrid' }
  }

  if (MAILGUN_API_KEY && MAILGUN_DOMAIN && MAILGUN_FROM) {
    const form = new URLSearchParams()
    form.set('from', MAILGUN_FROM)
    form.set('to', payload.to)
    form.set('subject', payload.subject)
    if (payload.text) form.set('text', payload.text)
    if (payload.html) form.set('html', payload.html)

    const auth = Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')
    const response = await fetch(`${MAILGUN_BASE_URL}/v3/${MAILGUN_DOMAIN}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(
        `Failed to send Mailgun email (status ${response.status}): ${body || response.statusText}`
      )
    }

    return { delivered: true, provider: 'mailgun' }
  }

  if (!EMAIL_WEBHOOK) {
    console.warn('[email] No email provider configured, skipping send')
    return { delivered: false, skipped: true, provider: 'none' }
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

  return { delivered: true, provider: 'webhook' }
}

export function buildReimbursementRequestEmail(payload: ReimbursementRequestEmailPayload) {
  const adminUrl = `${APP_BASE_URL}/admin/reimbursements`
  const employeeLabel = payload.employeeName || payload.employeeEmail || 'A team member'
  const subject = `New reimbursement request from ${employeeLabel}`
  const category = payload.category?.trim() || 'Uncategorized'
  const expenseAmount = typeof payload.expenseAmount === 'number'
    ? payload.expenseAmount
    : parseFloat(payload.expenseAmount)
  const reimbursementAmount = typeof payload.reimbursementAmount === 'number'
    ? payload.reimbursementAmount
    : parseFloat(payload.reimbursementAmount)

  const text = [
    `${employeeLabel} submitted a reimbursement request.`,
    '',
    `Employee email: ${payload.employeeEmail || 'Not provided'}`,
    `Request ID: ${payload.requestId}`,
    `Category: ${category}`,
    `Expense amount: ${formatCurrency(Number.isFinite(expenseAmount) ? expenseAmount : 0)}`,
    `Reimbursement amount: ${formatCurrency(Number.isFinite(reimbursementAmount) ? reimbursementAmount : 0)}`,
    `Year: ${payload.year}`,
    '',
    'Description:',
    payload.description,
    '',
    `Review it in Vestov Hub: ${adminUrl}`,
  ].join('\n')

  const html = `
    <p><strong>${escapeHtml(employeeLabel)}</strong> submitted a reimbursement request.</p>
    <table style="border-collapse:collapse; width:100%; max-width:560px; margin:16px 0;">
      <tbody>
        <tr><td style="padding:8px 12px; border:1px solid #e5e7eb;">Employee email</td><td style="padding:8px 12px; border:1px solid #e5e7eb;">${escapeHtml(payload.employeeEmail || 'Not provided')}</td></tr>
        <tr><td style="padding:8px 12px; border:1px solid #e5e7eb;">Request ID</td><td style="padding:8px 12px; border:1px solid #e5e7eb;">${payload.requestId}</td></tr>
        <tr><td style="padding:8px 12px; border:1px solid #e5e7eb;">Category</td><td style="padding:8px 12px; border:1px solid #e5e7eb;">${escapeHtml(category)}</td></tr>
        <tr><td style="padding:8px 12px; border:1px solid #e5e7eb;">Expense amount</td><td style="padding:8px 12px; border:1px solid #e5e7eb;"><strong>${formatCurrency(Number.isFinite(expenseAmount) ? expenseAmount : 0)}</strong></td></tr>
        <tr><td style="padding:8px 12px; border:1px solid #e5e7eb;">Reimbursement amount</td><td style="padding:8px 12px; border:1px solid #e5e7eb;"><strong>${formatCurrency(Number.isFinite(reimbursementAmount) ? reimbursementAmount : 0)}</strong></td></tr>
        <tr><td style="padding:8px 12px; border:1px solid #e5e7eb;">Year</td><td style="padding:8px 12px; border:1px solid #e5e7eb;">${payload.year}</td></tr>
      </tbody>
    </table>
    <p><strong>Description:</strong><br>${escapeHtml(payload.description)}</p>
    <p><a href="${adminUrl}" target="_blank" rel="noopener noreferrer">Review in Vestov Hub</a></p>
  `

  return { to: payload.to, subject, text, html }
}

export function buildVacationRequestEmail(payload: VacationRequestEmailPayload) {
  const adminUrl = `${APP_BASE_URL}/admin/vacation`
  const employeeLabel = payload.employeeName || payload.employeeEmail || 'A team member'
  const subject = `New ${payload.leaveTypeName} request from ${employeeLabel}`
  const text = [
    `${employeeLabel} submitted a ${payload.leaveTypeName} request.`,
    '',
    `Employee email: ${payload.employeeEmail || 'Not provided'}`,
    `Request ID: ${payload.requestId}`,
    `Dates: ${formatRequestDate(payload.startDate)} - ${formatRequestDate(payload.endDate)}`,
    `Days: ${payload.daysCount}`,
    '',
    'Reason:',
    payload.reason?.trim() || 'No reason provided',
    '',
    `Review it in Vestov Hub: ${adminUrl}`,
  ].join('\n')

  const html = `
    <p><strong>${escapeHtml(employeeLabel)}</strong> submitted a ${escapeHtml(payload.leaveTypeName)} request.</p>
    <table style="border-collapse:collapse; width:100%; max-width:560px; margin:16px 0;">
      <tbody>
        <tr><td style="padding:8px 12px; border:1px solid #e5e7eb;">Employee email</td><td style="padding:8px 12px; border:1px solid #e5e7eb;">${escapeHtml(payload.employeeEmail || 'Not provided')}</td></tr>
        <tr><td style="padding:8px 12px; border:1px solid #e5e7eb;">Request ID</td><td style="padding:8px 12px; border:1px solid #e5e7eb;">${payload.requestId}</td></tr>
        <tr><td style="padding:8px 12px; border:1px solid #e5e7eb;">Leave type</td><td style="padding:8px 12px; border:1px solid #e5e7eb;">${escapeHtml(payload.leaveTypeName)}</td></tr>
        <tr><td style="padding:8px 12px; border:1px solid #e5e7eb;">Dates</td><td style="padding:8px 12px; border:1px solid #e5e7eb;">${formatRequestDate(payload.startDate)} - ${formatRequestDate(payload.endDate)}</td></tr>
        <tr><td style="padding:8px 12px; border:1px solid #e5e7eb;">Days</td><td style="padding:8px 12px; border:1px solid #e5e7eb;"><strong>${payload.daysCount}</strong></td></tr>
      </tbody>
    </table>
    <p><strong>Reason:</strong><br>${escapeHtml(payload.reason?.trim() || 'No reason provided')}</p>
    <p><a href="${adminUrl}" target="_blank" rel="noopener noreferrer">Review in Vestov Hub</a></p>
  `

  return { to: payload.to, subject, text, html }
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

export function buildSalaryPaymentEmail(payload: SalaryPaymentEmailPayload) {
  const formattedMonth = formatSalaryMonth(payload.salaryMonth)
  const formattedDate = formatPaymentDate(payload.paymentDate)
  const extras = payload.extras.filter((item) => item.label && Number.isFinite(item.amount) && item.amount > 0)
  const extrasTotal = extras.reduce((sum, item) => sum + item.amount, 0)
  const subject = `Your salary breakdown for ${formattedMonth}`
  const description = payload.description?.trim() || ''

  const textLines = [
    `Hello ${payload.employeeName},`,
    '',
    `Your salary payment for ${formattedMonth} was recorded on ${formattedDate}.`,
  ]

  if (description) {
    textLines.push('', `Description: ${description}`)
  }

  textLines.push(
    '',
    `Base salary for month: ${formatCurrency(payload.baseSalary)}`,
    `Base salary paid now: ${formatCurrency(payload.salaryPaidNow)}`,
  )

  if (extras.length > 0) {
    textLines.push('', 'Extras included:')
    for (const extra of extras) {
      textLines.push(`- ${extra.label}: ${formatCurrency(extra.amount)}`)
    }
  }

  textLines.push(
    '',
    `Extras total: ${formatCurrency(extrasTotal)}`,
    `Total payout: ${formatCurrency(payload.totalPayout)}`,
    `Remaining salary balance for ${formattedMonth}: ${formatCurrency(payload.remainingSalary)}`
  )

  if (payload.note?.trim()) {
    textLines.push('', `Note: ${payload.note.trim()}`)
  }

  textLines.push('', 'If anything looks incorrect, please reply to this email or contact the admin team.')

  const html = `
    <p>Hello ${payload.employeeName},</p>
    <p>Your salary payment for <strong>${formattedMonth}</strong> was recorded on <strong>${formattedDate}</strong>.</p>
    ${description ? `<p><strong>Description:</strong> ${escapeHtml(description)}</p>` : ''}
    <table style="border-collapse:collapse; width:100%; max-width:560px; margin:16px 0;">
      <tbody>
        <tr>
          <td style="padding:8px 12px; border:1px solid #e5e7eb;">Base salary for month</td>
          <td style="padding:8px 12px; border:1px solid #e5e7eb; text-align:right;"><strong>${formatCurrency(payload.baseSalary)}</strong></td>
        </tr>
        <tr>
          <td style="padding:8px 12px; border:1px solid #e5e7eb;">Base salary paid now</td>
          <td style="padding:8px 12px; border:1px solid #e5e7eb; text-align:right;"><strong>${formatCurrency(payload.salaryPaidNow)}</strong></td>
        </tr>
        ${extras.map((extra) => `
          <tr>
            <td style="padding:8px 12px; border:1px solid #e5e7eb;">${escapeHtml(extra.label)}</td>
            <td style="padding:8px 12px; border:1px solid #e5e7eb; text-align:right;"><strong>${formatCurrency(extra.amount)}</strong></td>
          </tr>
        `).join('')}
        <tr>
          <td style="padding:8px 12px; border:1px solid #e5e7eb;">Extras total</td>
          <td style="padding:8px 12px; border:1px solid #e5e7eb; text-align:right;"><strong>${formatCurrency(extrasTotal)}</strong></td>
        </tr>
        <tr>
          <td style="padding:8px 12px; border:1px solid #e5e7eb;">Total payout</td>
          <td style="padding:8px 12px; border:1px solid #e5e7eb; text-align:right;"><strong>${formatCurrency(payload.totalPayout)}</strong></td>
        </tr>
        <tr>
          <td style="padding:8px 12px; border:1px solid #e5e7eb;">Remaining salary balance</td>
          <td style="padding:8px 12px; border:1px solid #e5e7eb; text-align:right;"><strong>${formatCurrency(payload.remainingSalary)}</strong></td>
        </tr>
      </tbody>
    </table>
    ${payload.note?.trim() ? `<p><strong>Note:</strong> ${escapeHtml(payload.note.trim())}</p>` : ''}
    <p>If anything looks incorrect, please reply to this email or contact the admin team.</p>
  `

  return {
    to: payload.to,
    subject,
    text: textLines.join('\n'),
    html,
  }
}
