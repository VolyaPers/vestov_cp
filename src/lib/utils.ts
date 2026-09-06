import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parse a date string (YYYY-MM-DD) as a local date without timezone conversion.
 * This prevents the off-by-one-day bug that occurs when using new Date() with date strings,
 * which interprets them as UTC midnight and can show the previous day in local timezone.
 */
export function parseLocalDate(dateString: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-').map(Number)
    const parsed = new Date(0)
    parsed.setFullYear(year, month - 1, day)
    parsed.setHours(0, 0, 0, 0)
    return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day
      ? parsed : new Date(NaN)
  }
  return new Date(dateString)
}

const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount)
}

export function formatDate(date?: string | Date | null): string {
  if (!date) return 'Not specified'
  const parsed = typeof date === 'string' ? parseLocalDate(date) : date
  return Number.isFinite(parsed.getTime()) ? dateFormatter.format(parsed) : 'Not specified'
}

export function calculateDays(
  startDate: string,
  endDate: string,
  halfDayStart = false,
  halfDayEnd = false
): number {
  const start = parseLocalDate(startDate)
  const end = parseLocalDate(endDate)

  if (start > end) return 0

  let adjustedDays = 0
  const cursor = new Date(start)
  while (cursor <= end) {
    const day = cursor.getDay()
    if (day !== 0 && day !== 6) {
      adjustedDays += 1
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  if (halfDayStart && start.getDay() !== 0 && start.getDay() !== 6) {
    adjustedDays -= 0.5
  }
  if (halfDayEnd && end.getDay() !== 0 && end.getDay() !== 6) {
    adjustedDays -= 0.5
  }

  return Math.max(0, adjustedDays)
}
