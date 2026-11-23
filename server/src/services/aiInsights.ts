import Anthropic from '@anthropic-ai/sdk'
import { db } from '../db/index.js'
import {
  clients, teamMembers, invoices, financialTransactions, payrollPeriods,
  clientServices, clientServiceTeamMembers, freelancerFees, leaveRequests,
  reimbursementRequests, timeEntries,
} from '../db/schema.js'
import { eq, desc, and, sql, isNull, gte, lte } from 'drizzle-orm'
import { paidInvoiceConditions } from '../lib/invoiceIncome.js'

function anthropic() {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY is not configured')
  return new Anthropic({ apiKey: key })
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function monthsAgo(n: number) {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  return d.toISOString().slice(0, 10)
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10)
}

async function gatherBusinessSnapshot() {
  const today = todayStr()
  const sixMonthsAgo = monthsAgo(6)
  const now = new Date()
  const thisMonthStart = startOfMonth(now)
  const thisMonthEnd = endOfMonth(now)
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthStart = startOfMonth(lastMonth)
  const lastMonthEnd = endOfMonth(lastMonth)

  const [
    clientRows,
    teamRows,
    invoiceRows,
    ledgerRows,
    payrollRows,
    freelancerFeeRows,
    leaveRows,
    reimbursementRows,
    timeRows,
    assignmentRows,
  ] = await Promise.all([
    db.select({
      id: clients.id, name: clients.name, status: clients.status,
      contractStart: clients.contractStart, contractEnd: clients.contractEnd,
      billingRate: clients.billingRate, billingCycle: clients.billingCycle,
    }).from(clients),

    db.select({
      id: teamMembers.id, name: teamMembers.name, status: teamMembers.status,
      employmentType: teamMembers.employmentType, isBillable: teamMembers.isBillable,
      position: teamMembers.position, startDate: teamMembers.startDate,
    }).from(teamMembers),

    db.select({
      id: invoices.id, clientId: invoices.clientId,
      invoiceNumber: invoices.invoiceNumber,
      amount: invoices.amount, status: invoices.status,
      invoiceDate: invoices.invoiceDate, dueDate: invoices.dueDate,
      paidAt: invoices.paidAt, periodStart: invoices.periodStart,
      periodEnd: invoices.periodEnd,
    }).from(invoices).orderBy(desc(invoices.invoiceDate)),

    db.select({
      type: financialTransactions.type,
      category: financialTransactions.category,
      amount: financialTransactions.amount,
      transactionDate: financialTransactions.transactionDate,
      teamMemberId: financialTransactions.teamMemberId,
      clientId: financialTransactions.clientId,
    }).from(financialTransactions)
      .where(and(isNull(financialTransactions.voidedAt), gte(financialTransactions.transactionDate, sixMonthsAgo))),

    db.select({
      teamMemberId: payrollPeriods.teamMemberId,
      salaryMonth: payrollPeriods.salaryMonth,
      baseSalary: payrollPeriods.baseSalary,
      status: payrollPeriods.status,
      employmentType: payrollPeriods.employmentType,
    }).from(payrollPeriods)
      .where(gte(payrollPeriods.salaryMonth, monthsAgo(6).slice(0, 7))),

    db.select({
      teamMemberId: freelancerFees.teamMemberId,
      amount: freelancerFees.amount,
      accruedDate: freelancerFees.accruedDate,
      status: freelancerFees.status,
    }).from(freelancerFees)
      .where(gte(freelancerFees.accruedDate, sixMonthsAgo)),

    db.select({
      employeeId: leaveRequests.employeeId,
      status: leaveRequests.status,
      startDate: leaveRequests.startDate,
      endDate: leaveRequests.endDate,
      daysCount: leaveRequests.daysCount,
    }).from(leaveRequests)
      .where(gte(leaveRequests.startDate, sixMonthsAgo)),

    db.select({
      id: reimbursementRequests.id,
      status: reimbursementRequests.status,
      reimbursementAmount: reimbursementRequests.reimbursementAmount,
    }).from(reimbursementRequests)
      .where(sql`${reimbursementRequests.status} IN ('pending', 'approved', 'confirmed')`),

    db.select({
      teamMemberId: timeEntries.teamMemberId,
      hours: timeEntries.hours,
      billable: timeEntries.billable,
      date: timeEntries.date,
      approved: timeEntries.approved,
    }).from(timeEntries)
      .where(gte(timeEntries.date, sixMonthsAgo)),

    db.select({
      id: clientServiceTeamMembers.id,
      clientServiceId: clientServiceTeamMembers.clientServiceId,
      teamMemberId: clientServiceTeamMembers.teamMemberId,
      hourlyRate: clientServiceTeamMembers.hourlyRate,
      fixedPrice: clientServiceTeamMembers.fixedPrice,
      isActive: clientServiceTeamMembers.isActive,
      employmentType: clientServiceTeamMembers.employmentType,
    }).from(clientServiceTeamMembers)
      .where(eq(clientServiceTeamMembers.isActive, true)),
  ])

  const clientMap = new Map(clientRows.map(c => [c.id, c.name]))

  return {
    today,
    thisMonthStart,
    thisMonthEnd,
    lastMonthStart,
    lastMonthEnd,
    clients: clientRows,
    team: teamRows,
    invoices: invoiceRows.map(inv => ({
      ...inv,
      clientName: clientMap.get(inv.clientId) ?? `Client #${inv.clientId}`,
    })),
    ledger: ledgerRows,
    payroll: payrollRows,
    freelancerFees: freelancerFeeRows,
    leave: leaveRows,
    reimbursements: reimbursementRows,
    timeEntries: timeRows,
    assignments: assignmentRows,
  }
}

function buildDataSummary(snapshot: Awaited<ReturnType<typeof gatherBusinessSnapshot>>) {
  const { clients, team, invoices, ledger, payroll, freelancerFees, leave, reimbursements, timeEntries, assignments } = snapshot

  const activeClients = clients.filter(c => c.status === 'active')
  const activeTeam = team.filter(t => t.status === 'active')
  const benchTeam = team.filter(t => t.status === 'bench')
  const fulltime = team.filter(t => t.employmentType === 'fulltime')
  const partTime = team.filter(t => t.employmentType === 'part_time')
  const freelancers = team.filter(t => t.employmentType === 'freelancer')
  const billable = team.filter(t => t.isBillable)

  const paidInvoices = invoices.filter(i => i.status === 'paid' && i.paidAt)
  const overdueInvoices = invoices.filter(i => {
    if (i.status === 'paid' || i.status === 'cancelled' || i.status === 'draft') return false
    if (!i.dueDate) return i.status === 'overdue'
    return new Date(i.dueDate) < new Date(snapshot.today)
  })
  const sentInvoices = invoices.filter(i => i.status === 'sent')
  const draftInvoices = invoices.filter(i => i.status === 'draft')

  const monthlyRevenue = new Map<string, number>()
  const monthlyExpenses = new Map<string, number>()
  for (const tx of ledger) {
    const month = String(tx.transactionDate).slice(0, 7)
    if (tx.type === 'income') {
      monthlyRevenue.set(month, (monthlyRevenue.get(month) ?? 0) + Number(tx.amount))
    } else {
      monthlyExpenses.set(month, (monthlyExpenses.get(month) ?? 0) + Math.abs(Number(tx.amount)))
    }
  }

  for (const inv of paidInvoices) {
    if (!inv.paidAt) continue
    const month = String(inv.paidAt).slice(0, 7)
    monthlyRevenue.set(month, (monthlyRevenue.get(month) ?? 0) + Number(inv.amount))
  }

  for (const tx of ledger) {
    const month = String(tx.transactionDate).slice(0, 7)
    if (['salary', 'extra_payment', 'expense'].includes(tx.type)) {
      monthlyExpenses.set(month, (monthlyExpenses.get(month) ?? 0) + Math.abs(Number(tx.amount)))
    }
  }

  const clientRevenue = new Map<string, number>()
  for (const inv of paidInvoices) {
    if (!inv.paidAt) continue
    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
    if (new Date(inv.paidAt) >= threeMonthsAgo) {
      clientRevenue.set(inv.clientName!, (clientRevenue.get(inv.clientName!) ?? 0) + Number(inv.amount))
    }
  }
  const totalRecentRevenue = [...clientRevenue.values()].reduce((s, v) => s + v, 0)

  const avgCollectionDays = (() => {
    const paid = paidInvoices.filter(i => i.invoiceDate && i.paidAt)
    if (!paid.length) return 0
    const total = paid.reduce((sum, i) => {
      const diff = new Date(i.paidAt!).getTime() - new Date(i.invoiceDate).getTime()
      return sum + Math.max(0, Math.round(diff / 86400000))
    }, 0)
    return Math.round(total / paid.length)
  })()

  const pendingLeave = leave.filter(l => l.status === 'pending')
  const pendingReimb = reimbursements.filter(r => r.status === 'pending')

  const totalBillableHours = timeEntries.filter(t => t.billable).reduce((s, t) => s + Number(t.hours), 0)
  const totalHours = timeEntries.reduce((s, t) => s + Number(t.hours), 0)

  return `
# Vestov HUB Business Snapshot — ${snapshot.today}

## Team
- Total: ${team.length} (Active: ${activeTeam.length}, Bench: ${benchTeam.length})
- Full-time: ${fulltime.length}, Part-time: ${partTime.length}, Freelancers: ${freelancers.length}
- Billable: ${billable.length}/${team.length} (${team.length ? Math.round(billable.length / team.length * 100) : 0}%)

## Clients
- Total: ${clients.length}, Active: ${activeClients.length}
${activeClients.map(c => `- ${c.name}: ${c.billingCycle ?? 'N/A'} billing, rate ${c.billingRate ?? 'N/A'}`).join('\n')}

## Client Revenue Concentration (last 90 days paid)
${[...clientRevenue.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([name, rev]) => `- ${name}: $${rev.toFixed(2)} (${totalRecentRevenue ? (rev / totalRecentRevenue * 100).toFixed(1) : 0}%)`)
    .join('\n') || '- No paid invoices in last 90 days'}

## Invoices
- Overdue: ${overdueInvoices.length} totaling $${overdueInvoices.reduce((s, i) => s + Number(i.amount), 0).toFixed(2)}
${overdueInvoices.map(i => `  - ${i.clientName} #${i.invoiceNumber ?? i.id}: $${Number(i.amount).toFixed(2)}, due ${i.dueDate}`).join('\n')}
- Sent (awaiting payment): ${sentInvoices.length} totaling $${sentInvoices.reduce((s, i) => s + Number(i.amount), 0).toFixed(2)}
- Drafts: ${draftInvoices.length}
- Average collection cycle: ${avgCollectionDays} days

## Monthly Revenue & Expenses (last 6 months)
${[...new Set([...monthlyRevenue.keys(), ...monthlyExpenses.keys()])].sort().map(month => {
    const rev = monthlyRevenue.get(month) ?? 0
    const exp = monthlyExpenses.get(month) ?? 0
    return `- ${month}: Revenue $${rev.toFixed(2)}, Expenses $${exp.toFixed(2)}, Net $${(rev - exp).toFixed(2)}`
  }).join('\n')}

## Payroll (last 6 months)
- Active salary periods: ${payroll.length}
- Open/unsettled: ${payroll.filter(p => p.status !== 'closed').length}
- Total monthly salary commitments: $${payroll.filter(p => p.salaryMonth === snapshot.today.slice(0, 7)).reduce((s, p) => s + Number(p.baseSalary ?? 0), 0).toFixed(2)}

## Freelancer Fees (last 6 months)
- Total accrued: $${freelancerFees.reduce((s, f) => s + Number(f.amount), 0).toFixed(2)}
- Pending payment: ${freelancerFees.filter(f => f.status === 'pending').length} fees

## Time Tracking (last 6 months)
- Total hours: ${totalHours.toFixed(1)}
- Billable hours: ${totalBillableHours.toFixed(1)} (${totalHours ? Math.round(totalBillableHours / totalHours * 100) : 0}%)

## Assignments
- Active assignments: ${assignments.length}

## Pending Approvals
- Leave requests pending: ${pendingLeave.length}
- Reimbursements pending: ${pendingReimb.length}
`.trim()
}

async function callClaude(systemPrompt: string, userPrompt: string): Promise<string> {
  const client = anthropic()
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })
  const textBlock = response.content.find(b => b.type === 'text')
  return textBlock?.text ?? ''
}

export interface InsightItem {
  title: string
  body: string
  priority: 'high' | 'medium' | 'low'
  category: 'finance' | 'team' | 'client' | 'operations' | 'risk'
}

export interface AiInsightsResponse {
  generatedAt: string
  morningBrief: string
  insights: InsightItem[]
  cashFlowForecast: {
    summary: string
    projections: Array<{ month: string; projected: string; confidence: string }>
  }
  clientHealth: Array<{
    clientName: string
    score: 'healthy' | 'watch' | 'at_risk'
    reason: string
  }>
  anomalies: Array<{
    title: string
    detail: string
    severity: 'high' | 'medium' | 'low'
  }>
}

const SYSTEM_PROMPT = `You are the AI business analyst for Vestov HUB, a service company management platform. You analyze real financial, team, and operational data to provide actionable CEO-level insights.

Rules:
- Be direct, specific, and data-driven. Use actual numbers from the data.
- Focus on what requires action or attention.
- Flag risks and opportunities, not just status.
- Keep language concise — CEO-grade brevity.
- Always respond with valid JSON matching the requested schema.
- Never invent data. If information is insufficient, say so.
- All monetary values are USD.`

export async function generateInsights(): Promise<AiInsightsResponse> {
  const snapshot = await gatherBusinessSnapshot()
  const dataSummary = buildDataSummary(snapshot)

  const userPrompt = `Here is the current business data:

${dataSummary}

Analyze this data and return a JSON object with this exact structure:
{
  "morningBrief": "2-3 sentence executive summary of what matters today. Lead with the most important signal — positive or negative.",
  "insights": [
    {
      "title": "Short title (max 60 chars)",
      "body": "1-2 sentence actionable insight with specific numbers",
      "priority": "high|medium|low",
      "category": "finance|team|client|operations|risk"
    }
  ],
  "cashFlowForecast": {
    "summary": "2-3 sentence cash flow outlook based on trends, receivables, and burn rate",
    "projections": [
      { "month": "YYYY-MM", "projected": "$X,XXX net", "confidence": "high|medium|low" }
    ]
  },
  "clientHealth": [
    {
      "clientName": "Name",
      "score": "healthy|watch|at_risk",
      "reason": "Brief reason based on payment patterns, revenue trends, contract status"
    }
  ],
  "anomalies": [
    {
      "title": "Short anomaly title",
      "detail": "What's unusual and why it matters",
      "severity": "high|medium|low"
    }
  ]
}

Requirements:
- Include 5-8 insights covering finance, profitability, team utilization, collections, and risk.
- Project cash flow for the next 3 months.
- Score ALL active clients.
- Flag any anomalies in expenses, revenue patterns, collection cycles, or staffing.
- Prioritize insights by business impact.

Return ONLY the JSON object, no markdown fences or other text.`

  const raw = await callClaude(SYSTEM_PROMPT, userPrompt)

  const parsed = JSON.parse(raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, ''))

  return {
    generatedAt: new Date().toISOString(),
    morningBrief: parsed.morningBrief ?? '',
    insights: Array.isArray(parsed.insights) ? parsed.insights : [],
    cashFlowForecast: parsed.cashFlowForecast ?? { summary: '', projections: [] },
    clientHealth: Array.isArray(parsed.clientHealth) ? parsed.clientHealth : [],
    anomalies: Array.isArray(parsed.anomalies) ? parsed.anomalies : [],
  }
}

export async function generateScenario(question: string): Promise<{ analysis: string }> {
  const snapshot = await gatherBusinessSnapshot()
  const dataSummary = buildDataSummary(snapshot)

  const result = await callClaude(SYSTEM_PROMPT, `
Based on this business data:

${dataSummary}

Answer the following CEO scenario question with specific numbers and projections:
"${question}"

Provide a thorough but concise analysis (3-5 paragraphs). Include specific dollar amounts, percentages, and timelines where possible. End with a clear recommendation.`)

  return { analysis: result }
}
