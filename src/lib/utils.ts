import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, parseISO } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parse a date string (YYYY-MM-DD) as a local date without timezone conversion.
 * This prevents the off-by-one-day bug that occurs when using new Date() with date strings,
 * which interprets them as UTC midnight and can show the previous day in local timezone.
 */
export function parseLocalDate(dateString: string): Date {
  // parseISO from date-fns correctly handles date-only strings as local dates
  return parseISO(dateString)
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  const parsedDate = typeof date === 'string' ? parseLocalDate(date) : date
  return format(parsedDate, 'd MMMM yyyy')
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
