import { Router } from 'express'
import { and, asc, eq, or, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { clients, financialTransactions, teamMembers, users } from '../db/schema.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth)

type SearchResult = {
  id: string
  type: 'user' | 'team_member' | 'client' | 'transaction'
  title: string
  subtitle: string
  href: string
  badge: string
  meta?: string
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

function clampLimit(rawLimit: unknown): number {
  const parsed = Number.parseInt(String(rawLimit ?? ''), 10)
  if (!Number.isFinite(parsed)) return 5
  return Math.min(Math.max(parsed, 1), 8)
}

function formatDate(dateValue?: string | Date | null): string {
  if (!dateValue) return ''
  const parsed = new Date(`${String(dateValue).split('T')[0]}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return ''
  return dateFormatter.format(parsed)
}

function formatCurrency(value?: string | number | null): string {
  if (value === null || value === undefined) return currencyFormatter.format(0)
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value)
  return currencyFormatter.format(Number.isFinite(parsed) ? parsed : 0)
}

function humanizeTransactionType(type: string): string {
  return type
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

router.get('/admin', async (req, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }

  const query = String(req.query.q ?? '').trim()
  const limit = clampLimit(req.query.limit)

  if (query.length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters long' })
  }

  try {
    const containsTerm = `%${query}%`
    const prefixTerm = `${query}%`

    const userRank = sql<number>`
      CASE
        WHEN lower(${users.fullName}) = lower(${query}) THEN 0
        WHEN lower(${users.email}) = lower(${query}) THEN 1
        WHEN lower(${users.username}) = lower(${query}) THEN 2
        WHEN lower(${users.fullName}) LIKE lower(${prefixTerm}) THEN 3
        WHEN lower(${users.email}) LIKE lower(${prefixTerm}) THEN 4
        WHEN lower(${users.username}) LIKE lower(${prefixTerm}) THEN 5
        ELSE 6
      END
    `

    const teamMemberRank = sql<number>`
      CASE
        WHEN lower(${teamMembers.name}) = lower(${query}) THEN 0
        WHEN lower(${teamMembers.email}) = lower(${query}) THEN 1
        WHEN lower(${teamMembers.name}) LIKE lower(${prefixTerm}) THEN 2
        WHEN lower(${teamMembers.email}) LIKE lower(${prefixTerm}) THEN 3
        WHEN lower(${teamMembers.position}) LIKE lower(${prefixTerm}) THEN 4
        ELSE 5
      END
    `

    const clientRank = sql<number>`
      CASE
        WHEN lower(${clients.name}) = lower(${query}) THEN 0
        WHEN lower(${clients.email}) = lower(${query}) THEN 1
        WHEN lower(${clients.name}) LIKE lower(${prefixTerm}) THEN 2
        WHEN lower(${clients.contactPerson}) LIKE lower(${prefixTerm}) THEN 3
        ELSE 4
      END
    `

    const transactionRank = sql<number>`
      CASE
        WHEN CAST(${financialTransactions.id} AS TEXT) = ${query} THEN 0
        WHEN lower(coalesce(${financialTransactions.description}, '')) LIKE lower(${prefixTerm}) THEN 1
        WHEN lower(coalesce(${financialTransactions.category}, '')) LIKE lower(${prefixTerm}) THEN 2
        WHEN lower(coalesce(${teamMembers.name}, '')) LIKE lower(${prefixTerm}) THEN 3
        WHEN lower(coalesce(${clients.name}, '')) LIKE lower(${prefixTerm}) THEN 4
        ELSE 5
      END
    `

    const [userRows, teamMemberRows, clientRows, transactionRows] = await Promise.all([
      db
        .select({
          id: users.id,
          fullName: users.fullName,
          email: users.email,
          username: users.username,
          role: users.role,
          position: users.position,
        })
        .from(users)
        .where(
          and(
            eq(users.isActive, true),
            or(
              sql`${users.fullName} ILIKE ${containsTerm}`,
              sql`${users.email} ILIKE ${containsTerm}`,
              sql`${users.username} ILIKE ${containsTerm}`,
              sql`coalesce(${users.position}, '') ILIKE ${containsTerm}`
            )
          )
        )
        .orderBy(userRank, asc(users.fullName))
        .limit(limit),
      db
        .select({
          id: teamMembers.id,
          name: teamMembers.name,
          email: teamMembers.email,
          position: teamMembers.position,
          status: teamMembers.status,
          clientId: teamMembers.clientId,
          clientName: clients.name,
        })
        .from(teamMembers)
        .leftJoin(clients, eq(teamMembers.clientId, clients.id))
        .where(
          or(
            sql`${teamMembers.name} ILIKE ${containsTerm}`,
            sql`${teamMembers.email} ILIKE ${containsTerm}`,
            sql`${teamMembers.position} ILIKE ${containsTerm}`,
            sql`coalesce(${teamMembers.location}, '') ILIKE ${containsTerm}`,
            sql`coalesce(${teamMembers.skills}, '[]'::jsonb)::text ILIKE ${containsTerm}`,
            sql`coalesce(${clients.name}, '') ILIKE ${containsTerm}`
          )
        )
        .orderBy(teamMemberRank, asc(teamMembers.name))
        .limit(limit),
      db
        .select({
          id: clients.id,
          name: clients.name,
          industry: clients.industry,
          contactPerson: clients.contactPerson,
          email: clients.email,
          status: clients.status,
        })
        .from(clients)
        .where(
          or(
            sql`${clients.name} ILIKE ${containsTerm}`,
            sql`coalesce(${clients.industry}, '') ILIKE ${containsTerm}`,
            sql`coalesce(${clients.contactPerson}, '') ILIKE ${containsTerm}`,
            sql`coalesce(${clients.email}, '') ILIKE ${containsTerm}`
          )
        )
        .orderBy(clientRank, asc(clients.name))
        .limit(limit),
      db
        .select({
          id: financialTransactions.id,
          type: financialTransactions.type,
          amount: financialTransactions.amount,
          category: financialTransactions.category,
          description: financialTransactions.description,
          transactionDate: financialTransactions.transactionDate,
          teamMemberName: teamMembers.name,
          clientName: clients.name,
        })
        .from(financialTransactions)
        .leftJoin(teamMembers, eq(financialTransactions.teamMemberId, teamMembers.id))
        .leftJoin(clients, eq(financialTransactions.clientId, clients.id))
        .where(
          or(
            sql`CAST(${financialTransactions.id} AS TEXT) ILIKE ${containsTerm}`,
            sql`coalesce(${financialTransactions.description}, '') ILIKE ${containsTerm}`,
            sql`coalesce(${financialTransactions.category}, '') ILIKE ${containsTerm}`,
            sql`${financialTransactions.type} ILIKE ${containsTerm}`,
            sql`coalesce(${teamMembers.name}, '') ILIKE ${containsTerm}`,
            sql`coalesce(${clients.name}, '') ILIKE ${containsTerm}`
          )
        )
        .orderBy(transactionRank, sql`${financialTransactions.transactionDate} DESC`, sql`${financialTransactions.id} DESC`)
        .limit(limit),
    ])

    const results = {
      users: userRows.map<SearchResult>((row) => ({
        id: `user:${row.id}`,
        type: 'user',
        title: row.fullName,
        subtitle: [row.email, row.position, row.role.replace('_', ' ')].filter(Boolean).join(' · '),
        href: `/admin/users?q=${encodeURIComponent(row.email)}`,
        badge: 'User',
        meta: row.username,
      })),
      teamMembers: teamMemberRows.map<SearchResult>((row) => ({
        id: `team:${row.id}`,
        type: 'team_member',
        title: row.name,
        subtitle: [row.position, row.clientName || 'Unassigned', row.email].filter(Boolean).join(' · '),
        href: `/admin/team-detail/${row.id}`,
        badge: 'Team',
        meta: row.status,
      })),
      clients: clientRows.map<SearchResult>((row) => ({
        id: `client:${row.id}`,
        type: 'client',
        title: row.name,
        subtitle: [row.industry, row.contactPerson, row.email].filter(Boolean).join(' · ') || 'Client account',
        href: `/admin/clients/${row.id}`,
        badge: 'Client',
        meta: row.status,
      })),
      transactions: transactionRows.map<SearchResult>((row) => ({
        id: `transaction:${row.id}`,
        type: 'transaction',
        title: row.description || row.category || `${humanizeTransactionType(row.type)} transaction`,
        subtitle: [
          formatCurrency(row.amount),
          humanizeTransactionType(row.type),
          row.clientName || row.teamMemberName,
          formatDate(row.transactionDate),
        ].filter(Boolean).join(' · '),
        href: `/admin/finances/transactions?q=${encodeURIComponent(String(row.id))}`,
        badge: 'Transaction',
        meta: row.category || undefined,
      })),
    }

    return res.json(results)
  } catch (error) {
    console.error('Admin search error:', error)
    return res.status(500).json({ error: 'Failed to search records' })
  }
})

export const searchRouter = router
