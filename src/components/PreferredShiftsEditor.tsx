import { useState } from 'react'
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
]

interface PreferredShiftsEditorProps {
  schedules: ShiftSchedule[]
  onSave: (schedules: ShiftSchedule[]) => void
  isSaving: boolean
  timezone?: string | null
}

function getDefaultSchedules(): ShiftSchedule[] {
  return WEEKDAYS.map((day) => ({
    dayOfWeek: day.dayOfWeek,
    startTime: '09:00',
    endTime: '18:00',
    isActive: true,
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

  function updateSchedule(dayOfWeek: number, field: keyof ShiftSchedule, value: any) {
    setLocalSchedules((prev) =>
      prev.map((s) => (s.dayOfWeek === dayOfWeek ? { ...s, [field]: value } : s))
    )
  }

  function copyFirstToAll() {
    const first = localSchedules[0]
    if (!first) return
    setLocalSchedules((prev) =>
      prev.map((s) => ({
        ...s,
        startTime: first.startTime,
        endTime: first.endTime,
        isActive: first.isActive,
      }))
    )
  }

  function handleSave() {
    onSave(localSchedules.filter((s) => s.isActive))
  }

  return (
    <div className="space-y-4">
      {timezone && (
        <p className="text-sm text-gray-500">
          Times are in your timezone: <span className="font-medium">{timezone}</span>
        </p>
      )}

      <div className="space-y-3">
        {localSchedules.map((schedule) => {
          const day = WEEKDAYS.find((d) => d.dayOfWeek === schedule.dayOfWeek)
          return (
            <div
              key={schedule.dayOfWeek}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                schedule.isActive ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-60'
              }`}
            >
              <div className="w-24">
                <Label className="text-sm font-medium">{day?.name}</Label>
              </div>
              <Switch
                checked={schedule.isActive}
                onCheckedChange={(checked) => updateSchedule(schedule.dayOfWeek, 'isActive', checked)}
              />
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={schedule.startTime}
                  onChange={(e) => updateSchedule(schedule.dayOfWeek, 'startTime', e.target.value)}
                  className="w-32"
                  disabled={!schedule.isActive}
                />
                <span className="text-gray-400">-</span>
                <Input
                  type="time"
                  value={schedule.endTime}
                  onChange={(e) => updateSchedule(schedule.dayOfWeek, 'endTime', e.target.value)}
                  className="w-32"
                  disabled={!schedule.isActive}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-2 pt-2">
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
