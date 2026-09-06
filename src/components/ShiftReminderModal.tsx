import { useCallback, useEffect, useState } from 'react'
import { Clock, Loader2, Play, SkipForward } from 'lucide-react'
import { api } from '../lib/api'
import { useCustomAlert } from './ui/custom-alert'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

const SESSION_KEY = 'shift-reminder-skipped'

interface UserService {
  serviceId: number
  serviceName: string
  clientName: string
  employmentType: 'fulltime' | 'part_time' | 'freelancer'
  workSchedule: Record<string, string>
  serviceTitle: string | null
  slackChannelId: string | null
}

export function ShiftReminderModal() {
  const { showAlert } = useCustomAlert()
  const [visible, setVisible] = useState(false)
  const [checking, setChecking] = useState(true)
  const [starting, setStarting] = useState(false)
  const [myServices, setMyServices] = useState<UserService[]>([])
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null)
  const [dismissKey, setDismissKey] = useState(SESSION_KEY)
  const [shiftNote, setShiftNote] = useState('')

  const dismiss = useCallback(() => {
    setVisible(false)
    sessionStorage.setItem(dismissKey, 'true')
  }, [dismissKey])

  useEffect(() => {
    const check = async () => {
      try {
        const [shiftRes, servicesRes, calendarRes] = await Promise.all([
          api.getCurrentShift(),
          api.getMyServices(),
          api.request('/shifts/calendar/me'),
        ])

        const today = calendarRes.days?.[0]
        const key = `${SESSION_KEY}:${calendarRes.employeeId}:${today?.date}`
        setDismissKey(key)
        if (sessionStorage.getItem(key) === 'true' || !today || today.workingMinutes <= 0 || shiftRes.hasActiveShift) {
          // Already on shift — nothing to do
          setChecking(false)
          return
        }

        // Set up services + auto-select
        const services: UserService[] = servicesRes.services
        setMyServices(services)

        if (services.length === 1) {
          setSelectedServiceId(services[0].serviceId)
        } else if (services.length > 1) {
          const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
          const today = dayNames[(servicesRes as any).localDayOfWeek]
          const scheduled = services.filter(
            (s) => s.workSchedule && s.workSchedule[today] && s.workSchedule[today] !== 'off'
          )
          if (scheduled.length === 1) {
            setSelectedServiceId(scheduled[0].serviceId)
          }
        }

        setVisible(true)
      } catch (err) {
        // If we can't check, don't block the user
        console.error('Shift reminder check failed:', err)
      } finally {
        setChecking(false)
      }
    }

    check()
  }, [])

  const handleStartShift = async () => {
    setStarting(true)
    try {
      const note = shiftNote?.trim() || ''
      await api.startShift(selectedServiceId || undefined, note || undefined)
      setVisible(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start shift'
      showAlert({ message: msg, type: 'error' })
    } finally {
      setStarting(false)
    }
  }

  // Don't render anything while checking or if not visible
  if (checking || !visible) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="mx-4 w-full max-w-md overflow-hidden rounded-[1.8rem] border border-white/70 bg-white/92 shadow-[0_36px_80px_-36px_rgba(15,23,42,0.85)] backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.24),transparent_34%),linear-gradient(135deg,rgba(15,23,42,1),rgba(12,74,110,0.92))] px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[1rem] bg-white/15">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold">Start your shift</h2>
              <p className="text-sm text-slate-200">You do not have an active shift yet</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-muted-foreground">
            Please start your shift to begin tracking your work hours, or skip if you're just checking in.
          </p>

          {myServices.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Service Context
              </label>
              <select
                value={selectedServiceId || ''}
                onChange={(e) => setSelectedServiceId(e.target.value ? Number(e.target.value) : null)}
                disabled={starting}
                className="w-full rounded-xl border border-input/80 bg-background/90 p-2.5 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">No specific service</option>
                {myServices.map((service) => (
                  <option key={service.serviceId} value={service.serviceId}>
                    {service.clientName} - {service.serviceTitle || service.serviceName}
                    {service.serviceTitle ? ` (${service.serviceName})` : ''}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground">
                Optional — choose the project for this shift
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Note
            </label>
            <Textarea
              value={shiftNote}
              onChange={(e) => setShiftNote(e.target.value)}
              disabled={starting}
              placeholder="Optional work note. Start time is recorded when you press Start Shift."
              rows={2}
              className="min-h-[84px] resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <Button
            onClick={dismiss}
            disabled={starting}
            variant="outline"
            className="flex-1"
          >
            <SkipForward className="h-4 w-4" />
            Skip
          </Button>
          <Button
            onClick={handleStartShift}
            disabled={starting}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
          >
            {starting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" fill="currentColor" />
            )}
            Start Shift
          </Button>
        </div>
      </div>
    </div>
  )
}
