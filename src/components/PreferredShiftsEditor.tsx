import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Copy, Save } from 'lucide-react'
import type { ShiftSchedule } from '@/types/common'

const WEEKDAYS = [
  { dayOfWeek: 1, name: 'Monday' },
  { dayOfWeek: 2, name: 'Tuesday' },
  { dayOfWeek: 3, name: 'Wednesday' },
  { dayOfWeek: 4, name: 'Thursday' },
  { dayOfWeek: 5, name: 'Friday' },
  { dayOfWeek: 6, name: 'Saturday' },
  { dayOfWeek: 0, name: 'Sunday' },
]

interface PreferredShiftsEditorProps {
  schedules: ShiftSchedule[]
  onSave: (schedules: ShiftSchedule[]) => void | Promise<void>
  isSaving: boolean
  timezone?: string | null
}

function getDefaultSchedules(): ShiftSchedule[] {
  return WEEKDAYS.map((day) => ({
    dayOfWeek: day.dayOfWeek,
    startTime: '09:00',
    endTime: '18:00',
    isActive: day.dayOfWeek >= 1 && day.dayOfWeek <= 5,
  }))
}

function mergeSchedules(existing: ShiftSchedule[]): ShiftSchedule[] {
  return WEEKDAYS.map((day) => {
    const found = existing.find((s) => s.dayOfWeek === day.dayOfWeek)
    if (found) {
      return { ...found }
    }
    return {
      dayOfWeek: day.dayOfWeek,
      startTime: '09:00',
      endTime: '18:00',
      isActive: false,
    }
  })
}

export function PreferredShiftsEditor({ schedules, onSave, isSaving, timezone }: PreferredShiftsEditorProps) {
  const [localSchedules, setLocalSchedules] = useState<ShiftSchedule[]>(() =>
    schedules.length > 0 ? mergeSchedules(schedules) : getDefaultSchedules()
  )

  const [dirty, setDirty] = useState(false)
  useEffect(() => { if (!dirty) setLocalSchedules(schedules.length ? mergeSchedules(schedules) : getDefaultSchedules()) }, [schedules, dirty])

  function updateSchedule(dayOfWeek: number, field: keyof ShiftSchedule, value: any) {
    setDirty(true)
    setLocalSchedules((prev) =>
      prev.map((s) => (s.dayOfWeek === dayOfWeek ? { ...s, [field]: value } : s))
    )
  }

  function copyFirstToAll() {
    const first = localSchedules[0]
    if (!first) return
    setDirty(true)
    setLocalSchedules((prev) =>
      prev.map((s) => ({
        ...s,
        startTime: first.startTime,
        endTime: first.endTime,
        isActive: first.isActive,
      }))
    )
  }

  async function handleSave() {
    try { await onSave(localSchedules); setDirty(false) } catch { /* Parent displays the error and keeps this draft. */ }
  }

  return (
    <div className="space-y-4">
      {timezone && (
        <p className="text-sm text-muted-foreground">
          Times are shown in your timezone: <span className="font-semibold text-foreground">{timezone}</span>
        </p>
      )}

      <div className="divide-y">
        {localSchedules.map((schedule) => {
          const day = WEEKDAYS.find((d) => d.dayOfWeek === schedule.dayOfWeek)
          return (
            <div
              key={schedule.dayOfWeek}
              className="grid grid-cols-[1fr_auto] items-center gap-3 py-3 sm:grid-cols-[100px_44px_1fr]"
            >
              <div className="w-28">
                <Label className="text-sm font-semibold text-foreground">{day?.name}</Label>
              </div>
              <Switch
                aria-label={`${day?.name} working day`}
                checked={schedule.isActive}
                onCheckedChange={(checked) => updateSchedule(schedule.dayOfWeek, 'isActive', checked)}
              />
              <div className="col-span-2 flex min-w-0 items-center gap-2 sm:col-span-1">
                <Input
                  type="time"
                  aria-label={`${day?.name} start time`}
                  value={schedule.startTime}
                  onChange={(e) => updateSchedule(schedule.dayOfWeek, 'startTime', e.target.value)}
                  className="min-w-0 flex-1 sm:max-w-36"
                  disabled={!schedule.isActive}
                />
                <span className="text-muted-foreground">-</span>
                <Input
                  type="time"
                  aria-label={`${day?.name} end time`}
                  value={schedule.endTime}
                  onChange={(e) => updateSchedule(schedule.dayOfWeek, 'endTime', e.target.value)}
                  className="min-w-0 flex-1 sm:max-w-36"
                  disabled={!schedule.isActive}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={copyFirstToAll} type="button">
          <Copy className="h-4 w-4 mr-1" />
          Copy Monday to all
        </Button>
        <div className="flex-1" />
        <Button onClick={handleSave} disabled={isSaving} size="sm">
          <Save className="h-4 w-4 mr-1" />
          {isSaving ? 'Saving...' : 'Save Shifts'}
        </Button>
      </div>
    </div>
  )
}
