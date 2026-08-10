function toLocalDateParts(value: string | Date): { y: number; m: number; d: number } {
  if (typeof value === 'string') {
    const [y, m, d] = value.slice(0, 10).split('-').map(Number)
    return { y, m, d }
  }

  const isMidnightUtc =
    value.getUTCHours() === 0 &&
    value.getUTCMinutes() === 0 &&
    value.getUTCSeconds() === 0 &&
    value.getUTCMilliseconds() === 0

  if (isMidnightUtc) {
    return {
      y: value.getUTCFullYear(),
      m: value.getUTCMonth() + 1,
      d: value.getUTCDate(),
    }
  }

  return {
    y: value.getFullYear(),
    m: value.getMonth() + 1,
    d: value.getDate(),
  }
}

/** Format a date as YYYY-MM-DD using local/calendar parts (never toISOString — avoids TZ day shifts). */
export function formatDateOnlyLocal(value: string | Date): string {
  const { y, m, d } = toLocalDateParts(value)
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * Vacation 50/50 half boundary: July 1 within the employment cycle.
 * Jan–Jun = first half of the year; Jul–Dec = second half.
 * Falls back to +6 months from cycle start if no July 1 falls in the cycle.
 */
export function getCalendarHalfMidpoint(
  cycleStart: string | Date,
  cycleEnd: string | Date
): string {
  const start = formatDateOnlyLocal(cycleStart)
  const end = formatDateOnlyLocal(cycleEnd)
  const startYear = Number(start.slice(0, 4))

  let july1 = `${startYear}-07-01`
  if (july1 < start) {
    july1 = `${startYear + 1}-07-01`
  }

  if (july1 > end) {
    const { y, m, d } = toLocalDateParts(start)
    const mid = new Date(y, m - 1 + 6, d)
    return formatDateOnlyLocal(mid)
  }

  return july1
}

function isWeekend(y: number, m: number, d: number): boolean {
  const day = new Date(y, m - 1, d).getDay()
  return day === 0 || day === 6
}

/**
 * Count working days between dates (exclusive of weekends).
 * Inclusive range; optional 0.5 on first/last day when those days are weekdays.
 */
export function calculateDays(
  startDate: string | Date,
  endDate: string | Date,
  halfDayStart = false,
  halfDayEnd = false
): number {
  const start = toLocalDateParts(startDate)
  const end = toLocalDateParts(endDate)

  const cursor = new Date(start.y, start.m - 1, start.d)
  const last = new Date(end.y, end.m - 1, end.d)

  if (cursor > last) return 0

  let adjustedDays = 0
  while (cursor <= last) {
    const day = cursor.getDay()
    if (day !== 0 && day !== 6) {
      adjustedDays += 1
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  if (halfDayStart && !isWeekend(start.y, start.m, start.d)) {
    adjustedDays -= 0.5
  }
  if (halfDayEnd && !isWeekend(end.y, end.m, end.d)) {
    adjustedDays -= 0.5
  }

  return Math.max(0, adjustedDays)
}

export function isToday(date: string): boolean {
  const today = new Date()
  const checkDate = new Date(date)

  return today.toDateString() === checkDate.toDateString()
}

export function isThisWeek(date: string): boolean {
  const today = new Date()
  const checkDate = new Date(date)

  const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()))
  const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6))

  return checkDate >= startOfWeek && checkDate <= endOfWeek
}
