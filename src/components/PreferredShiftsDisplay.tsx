import { convertTime, getDayName, getTimezoneAbbreviation, getBrowserTimezone } from '@/lib/timezone'
import type { ShiftSchedule } from '@/types/common'

interface PreferredShiftsDisplayProps {
  schedules: ShiftSchedule[]
  employeeTimezone: string | null
  viewerTimezone?: string | null
  showEmployeeTime?: boolean
}

const WEEKDAY_ORDER = [1, 2, 3, 4, 5] // Mon-Fri

function formatTimeRange(start: string, end: string, tz: string): string {
  const abbr = getTimezoneAbbreviation(tz)
  return `${start} - ${end} ${abbr}`
}

export function PreferredShiftsDisplay({
  schedules,
  employeeTimezone,
  viewerTimezone,
  showEmployeeTime = true,
}: PreferredShiftsDisplayProps) {
  const viewerTz = viewerTimezone || getBrowserTimezone()
  const empTz = employeeTimezone || 'UTC'
  const isSameTimezone = viewerTz === empTz

  if (schedules.length === 0) {
    return <p className="text-sm text-gray-400 italic">No preferred shifts set</p>
  }

  // Sort and filter to weekdays
  const sorted = WEEKDAY_ORDER
    .map((day) => schedules.find((s) => s.dayOfWeek === day && s.isActive))
    .filter(Boolean) as ShiftSchedule[]

  if (sorted.length === 0) {
    return <p className="text-sm text-gray-400 italic">No active preferred shifts</p>
  }

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[80px_1fr_1fr] gap-2 text-xs font-medium text-gray-500 uppercase tracking-wide pb-1 border-b border-gray-100">
        <div>Day</div>
        {showEmployeeTime && !isSameTimezone && <div>Member Time</div>}
        <div>{isSameTimezone ? 'Time' : 'Your Time'}</div>
      </div>
      {sorted.map((schedule) => {
        const converted = convertTime(schedule.startTime, empTz, viewerTz)
        const convertedEnd = convertTime(schedule.endTime, empTz, viewerTz)

        const dayName = getDayName(schedule.dayOfWeek)
        const shortDay = dayName.slice(0, 3)

        let viewerDayLabel = ''
        if (converted.dayOffset !== 0) {
          const adjustedDay = schedule.dayOfWeek + converted.dayOffset
          const wrappedDay = adjustedDay < 0 ? 6 : adjustedDay > 6 ? 0 : adjustedDay
          viewerDayLabel = ` (${getDayName(wrappedDay).slice(0, 3)})`
        }

        return (
          <div key={schedule.dayOfWeek} className="grid grid-cols-[80px_1fr_1fr] gap-2 py-1.5 text-sm">
            <div className="font-medium text-gray-700">{shortDay}</div>
            {showEmployeeTime && !isSameTimezone && (
              <div className="text-gray-500">
                {formatTimeRange(schedule.startTime, schedule.endTime, empTz)}
              </div>
            )}
            <div className="text-gray-900 font-medium">
              {converted.time} - {convertedEnd.time} {converted.abbreviation}
              {viewerDayLabel && <span className="text-xs text-gray-400 ml-1">{viewerDayLabel}</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
