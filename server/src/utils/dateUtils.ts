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

function isWeekend(y: number, m: number, d: number): boolean {
  const day = new Date(y, m - 1, d).getDay()
  return day === 0 || day === 6
}

/**
 * Count working days between dates (excludes Saturday and Sunday).
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
