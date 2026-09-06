/** Money enters through a strict decimal boundary; calculations use integer cents. */
export class FinanceValidationError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}
export function cents(value: unknown, label = 'Amount', allowZero = true): number {
  const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : ''
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new FinanceValidationError(`${label} must be a non-negative amount with at most two decimal places`)
  const [whole, fraction = ''] = text.split('.')
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(result) || result > 9999999999 || (!allowZero && result === 0)) throw new FinanceValidationError(`${label} is outside the allowed range`)
  return result
}
export const money = (value: number) => (value / 100).toFixed(2)
export function validDate(value: unknown, label = 'Date'): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) throw new FinanceValidationError(`${label} must be a valid YYYY-MM-DD date`)
  return value
}
export function validMonth(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw new FinanceValidationError('Salary month must be YYYY-MM')
  validDate(`${value}-01`)
  return value
}
export function positiveId(value: unknown, label = 'ID'): number {
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id <= 0) throw new FinanceValidationError(`${label} must be a positive integer`)
  return id
}
export function idempotencyKey(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{16,100}$/.test(value)) throw new FinanceValidationError('A valid idempotency key is required')
  return value
}
export type MoneyExtra = { label: string; amount: string; reimbursementId?: number }
export function salaryExtras(value: unknown): MoneyExtra[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > 100) throw new FinanceValidationError('Extras must be an array of at most 100 items')
  return value.map((extra: any) => {
    if (!extra || typeof extra.label !== 'string' || !extra.label.trim() || extra.label.trim().length > 200) throw new FinanceValidationError('Every extra requires a label (maximum 200 characters)')
    return { label: extra.label.trim(), amount: money(cents(extra.amount, 'Extra amount', false)), ...(extra.reimbursementId ? { reimbursementId: positiveId(extra.reimbursementId, 'Reimbursement ID') } : {}) }
  })
}
export function financeError(res: any, error: unknown, fallback: string) {
  if (error instanceof FinanceValidationError) return res.status(error.status).json({ error: error.message })
  console.error(fallback, error)
  return res.status(500).json({ error: fallback })
}
