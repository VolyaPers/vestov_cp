import { useCallback, useEffect, useState } from 'react'
import { Clock, Loader2, Play, SkipForward } from 'lucide-react'
import { api } from '../lib/api'
import { useCustomAlert } from './ui/custom-alert'

const SESSION_KEY = 'shift-reminder-skipped'

interface UserService {
  serviceId: number
  serviceName: string
  clientName: string
  employmentType: 'fulltime' | 'part_time'
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
  const [shiftNote, setShiftNote] = useState('')

  const dismiss = useCallback(() => {
    setVisible(false)
    sessionStorage.setItem(SESSION_KEY, 'true')
  }, [])

  useEffect(() => {
    // If already skipped this session, don't show
    if (sessionStorage.getItem(SESSION_KEY) === 'true') {
      setChecking(false)
      return
    }

    const check = async () => {
      try {
        const [shiftRes, servicesRes] = await Promise.all([
          api.getCurrentShift(),
          api.getMyServices(),
        ])

        if (shiftRes.hasActiveShift) {
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
          const today = dayNames[new Date().getDay()]
          const scheduled = services.find(
            (s) => s.workSchedule && s.workSchedule[today] && s.workSchedule[today] !== 'off'
          )
          if (scheduled) {
            setSelectedServiceId(scheduled.serviceId)
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
        className="mx-4 w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Start Your Shift</h2>
              <p className="text-sm text-blue-100">You don't have an active shift</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">
            Please start your shift to begin tracking your work hours, or skip if you're just checking in.
          </p>

          {/* Service selector */}
          {myServices.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Service Context
              </label>
              <select
                value={selectedServiceId || ''}
                onChange={(e) => setSelectedServiceId(e.target.value ? Number(e.target.value) : null)}
                disabled={starting}
                className="w-full rounded-lg border border-gray-200 bg-white p-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No specific service</option>
                {myServices.map((service) => (
                  <option key={service.serviceId} value={service.serviceId}>
                    {service.clientName} - {service.serviceTitle || service.serviceName}
                    {service.serviceTitle ? ` (${service.serviceName})` : ''}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-gray-400">
                Optional — notifications go to default channel if not selected
              </p>
            </div>
          )}

          {/* Shift note */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Note
            </label>
            <textarea
              value={shiftNote}
              onChange={(e) => setShiftNote(e.target.value)}
              disabled={starting}
              placeholder="Optional note (e.g. started 40 mins ago)..."
              rows={2}
              className="w-full rounded-lg border border-gray-200 bg-white p-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={dismiss}
            disabled={starting}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <SkipForward className="h-4 w-4" />
            Skip
          </button>
          <button
            onClick={handleStartShift}
            disabled={starting}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-green-500 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-600 disabled:opacity-50"
          >
            {starting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" fill="currentColor" />
            )}
            Start Shift
          </button>
        </div>
      </div>
    </div>
  )
}
