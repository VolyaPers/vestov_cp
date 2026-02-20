/**
 * Timezone conversion utilities using native Intl.DateTimeFormat.
 * No external dependencies required.
 */

export function getBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export function getTimezoneAbbreviation(timezone: string, date?: Date): string {
  const d = date || new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'short',
  }).formatToParts(d)
  return parts.find((p) => p.type === 'timeZoneName')?.value || timezone
}

function getUtcOffset(timezone: string, date: Date): number {
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' })
  const tzStr = date.toLocaleString('en-US', { timeZone: timezone })
  const utcDate = new Date(utcStr)
  const tzDate = new Date(tzStr)
  return (tzDate.getTime() - utcDate.getTime()) / (1000 * 60)
}

/**
 * Convert a time string (HH:MM) from one timezone to another.
 * Uses a reference Monday to compute the conversion accurately (DST-aware).
 */
export function convertTime(
  time: string,
  fromTimezone: string,
  toTimezone: string,
  referenceDate?: Date,
): { time: string; dayOffset: number; abbreviation: string } {
  const [hours, minutes] = time.split(':').map(Number)

  // Use a reference date (default: next Monday) for consistent weekday mapping
  const ref = referenceDate || getNextMonday()
  ref.setHours(12, 0, 0, 0) // noon to avoid DST edge cases

  const fromOffset = getUtcOffset(fromTimezone, ref)
  const toOffset = getUtcOffset(toTimezone, ref)
  const diffMinutes = toOffset - fromOffset

  let totalMinutes = hours * 60 + minutes + diffMinutes
  let dayOffset = 0

  if (totalMinutes < 0) {
    dayOffset = -1
    totalMinutes += 24 * 60
  } else if (totalMinutes >= 24 * 60) {
    dayOffset = 1
    totalMinutes -= 24 * 60
  }

  const newHours = Math.floor(totalMinutes / 60)
  const newMinutes = totalMinutes % 60

  return {
    time: `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`,
    dayOffset,
    abbreviation: getTimezoneAbbreviation(toTimezone, ref),
  }
}

function getNextMonday(): Date {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? 1 : day === 1 ? 0 : 8 - day
  d.setDate(d.getDate() + diff)
  return d
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
const SHORT_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export function getDayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek] || ''
}

export function getShortDayName(dayOfWeek: number): string {
  return SHORT_DAY_NAMES[dayOfWeek] || ''
}

/**
 * Format time with timezone abbreviation, e.g. "09:00 EET"
 */
export function formatTimeWithTz(time: string, timezone: string): string {
  return `${time} ${getTimezoneAbbreviation(timezone)}`
}

export interface TimezoneOption {
  value: string
  label: string
  offset: string
}

function formatOffset(minutes: number): string {
  const sign = minutes >= 0 ? '+' : '-'
  const abs = Math.abs(minutes)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `UTC${sign}${h}${m ? `:${String(m).padStart(2, '0')}` : ''}`
}

export const COMMON_TIMEZONES: TimezoneOption[] = (() => {
  const zones = [
    'Pacific/Honolulu',
    'America/Anchorage',
    'America/Los_Angeles',
    'America/Denver',
    'America/Chicago',
    'America/New_York',
    'America/Sao_Paulo',
    'Atlantic/Azores',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Europe/Helsinki',
    'Europe/Kyiv',
    'Europe/Moscow',
    'Asia/Dubai',
    'Asia/Kolkata',
    'Asia/Bangkok',
    'Asia/Shanghai',
    'Asia/Tokyo',
    'Australia/Sydney',
    'Pacific/Auckland',
  ]

  const now = new Date()
  return zones.map((tz) => {
    const offset = getUtcOffset(tz, now)
    const abbr = getTimezoneAbbreviation(tz, now)
    const offsetStr = formatOffset(offset)
    return {
      value: tz,
      label: `${tz.replace(/_/g, ' ')} (${abbr}, ${offsetStr})`,
      offset: offsetStr,
    }
  })
})()
