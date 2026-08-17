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
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffTime = Math.abs(end.getTime() - start.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
  
  let adjustedDays = diffDays
  if (halfDayStart) adjustedDays -= 0.5
  if (halfDayEnd) adjustedDays -= 0.5
  
  return Math.max(0, adjustedDays)
}
