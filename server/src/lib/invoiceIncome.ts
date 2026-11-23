import { and, eq, isNotNull, not, sql, type SQL } from 'drizzle-orm'
import { invoices } from '../db/schema.js'

export const invoicePaymentExcluded = sql<boolean>`COALESCE(${invoices.financeExcludedPaidAt} = ${invoices.paidAt}, false)`

export function paidInvoiceConditions(startDate?: string, endDate?: string, includeExcluded = false) {
  const conditions: SQL[] = [eq(invoices.status, 'paid'), isNotNull(invoices.paidAt)]
  if (!includeExcluded) conditions.push(not(invoicePaymentExcluded))
  if (startDate) conditions.push(sql`${invoices.paidAt} >= ${startDate}::date`)
  if (endDate) conditions.push(sql`${invoices.paidAt} < (${endDate}::date + interval '1 day')`)
  return and(...conditions)
}
