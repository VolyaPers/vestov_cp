import { useState, useEffect, useCallback } from 'react'
import { Play, Square, Coffee, Clock, AlertCircle } from 'lucide-react'
import { api } from '../lib/api'
import { useShiftEvents, useShiftUpdateListener } from '../hooks/useSocket'
import { useCustomAlert } from '@/components/ui/custom-alert'

interface Shift {
  id: number
  employeeId: number
  startTime: string
  endTime: string | null
  status: 'active' | 'on_break' | 'completed'
  isLate: boolean
  lateMinutes: number
}

interface UserService {
  serviceId: number
  serviceName: string
  clientName: string
  employmentType: 'fulltime' | 'part_time' | 'freelancer'
  workSchedule: Record<string, string>
  slackChannelId: string | null
}

interface ShiftBreak {
  id: number
  shiftId: number
  startTime: string
  endTime: string | null
}

export function ShiftControls() {
  const { showConfirm } = useCustomAlert()
  const [currentShift, setCurrentShift] = useState<Shift | null>(null)
  const [activeBreak, setActiveBreak] = useState<ShiftBreak | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [myServices, setMyServices] = useState<UserService[]>([])
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null)
  const [shiftNote, setShiftNote] = useState('')
  const [isFullTime, setIsFullTime] = useState(false)
  const [hasTeamMember, setHasTeamMember] = useState<boolean | null>(null)

  // WebSocket connection for real-time shift updates
  useShiftEvents()

  // Fetch current shift status
  const fetchCurrentShift = useCallback(async () => {
    try {
      const response = await api.request('/shifts/current')
      if (response.hasActiveShift) {
        setCurrentShift(response.shift)
        setActiveBreak(response.activeBreak)
        if (response.shift?.serviceId) {
          setSelectedServiceId(response.shift.serviceId)
        }
      } else {
        setCurrentShift(null)
        setActiveBreak(null)
      }
    } catch (err) {
      console.error('Error fetching current shift:', err)
    }
  }, [])

  // Listen for WebSocket shift events and refetch
  useShiftUpdateListener(fetchCurrentShift)

  const fetchMyServices = async () => {
    try {
      const response = await api.getMyServices() as { services: UserService[], hasTeamMember?: boolean }
      setMyServices(response.services)
      setHasTeamMember(response.hasTeamMember !== false)

      if (response.services.length === 1) {
        setSelectedServiceId(response.services[0].serviceId)
        setIsFullTime(response.services[0].employmentType === 'fulltime')
      } else if (response.services.length > 1) {
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
        const today = dayNames[new Date().getDay()]

        // Find all services scheduled for today (not "off")
        const scheduledServices = response.services.filter(s =>
          s.workSchedule && s.workSchedule[today] && s.workSchedule[today] !== 'off'
        )

        // Only pre-select if EXACTLY 1 service is scheduled for today
        if (scheduledServices.length === 1) {
          setSelectedServiceId(scheduledServices[0].serviceId)
          setIsFullTime(scheduledServices[0].employmentType === 'fulltime')
        }
        // If 0 or more than 1 service for today, leave unselected
      }
    } catch (err) {
      console.error('Error fetching my services:', err)
      // If API fails, we can't determine team member status - set to false to show warning
      setHasTeamMember(false)
    }
  }

  useEffect(() => {
    fetchCurrentShift()
    fetchMyServices()
    // 5 min fallback (WebSocket handles real-time updates)
    const interval = setInterval(fetchCurrentShift, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchCurrentShift])

  const handleStartShift = async () => {
    setLoading(true)
    setError(null)

    try {
      // Service selection is optional - if not selected, notifications go to default channel
      const note = shiftNote?.trim() || ''
      const response = await api.startShift(selectedServiceId || undefined, note || undefined)
      setCurrentShift(response.shift)
      setActiveBreak(null)
      setShiftNote('')
    } catch (err: any) {
      setError(err.message || 'Failed to start shift')
    } finally {
      setLoading(false)
    }
  }

  const handleEndShift = async () => {
    const confirmed = await showConfirm({
      title: 'End Shift',
      message: 'Are you sure you want to end your shift?',
      type: 'warning',
      confirmText: 'End Shift',
      cancelText: 'Cancel',
    })

    if (!confirmed) return

    setLoading(true)
    setError(null)
    try {
      await api.request('/shifts/end', { method: 'POST' })
      setCurrentShift(null)
      setActiveBreak(null)
    } catch (err: any) {
      setError(err.message || 'Failed to end shift')
    } finally {
      setLoading(false)
    }
  }

  const handleStartBreak = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.request('/shifts/break/start', { method: 'POST' })
      setActiveBreak(response.break)
      if (currentShift) {
        setCurrentShift({ ...currentShift, status: 'on_break' })
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start break')
    } finally {
      setLoading(false)
    }
  }

  const handleEndBreak = async () => {
    setLoading(true)
    setError(null)
    try {
      await api.request('/shifts/break/end', { method: 'POST' })
      setActiveBreak(null)
      if (currentShift) {
        setCurrentShift({ ...currentShift, status: 'active' })
      }
    } catch (err: any) {
      setError(err.message || 'Failed to end break')
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getDuration = (start: string, end?: string | null) => {
    const startDate = new Date(start)
    const endDate = end ? new Date(end) : new Date()
    const diff = endDate.getTime() - startDate.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  return (
    <div className="rounded-[1.6rem] border border-white/80 bg-white/82 p-6 shadow-[0_24px_48px_-24px_rgba(15,23,42,0.45)] backdrop-blur-xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-xl font-semibold text-foreground flex items-center gap-2">
          <Clock className="w-6 h-6 text-primary" />
          Shift Control
        </h2>
        {currentShift && (
          <div className="text-sm">
            <span className="text-muted-foreground">Started at </span>
            <span className="font-semibold text-foreground">
              {formatTime(currentShift.startTime)}
            </span>
            <span className="text-muted-foreground ml-3">Duration: </span>
            <span className="font-semibold text-foreground">
              {getDuration(currentShift.startTime)}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-3 rounded-[1.2rem] border border-red-200 bg-red-50 p-4">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {hasTeamMember === false && (
        <div className="mb-4 flex items-start gap-3 rounded-[1.2rem] border border-amber-200 bg-amber-50 p-4">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              Your account is not linked to a team member profile.
            </p>
            <p className="text-sm text-amber-700 mt-1">
              Please contact an administrator to set up your team member profile before you can start tracking shifts.
            </p>
          </div>
        </div>
      )}

      {currentShift && currentShift.isLate && (
        <div className="mb-4 flex items-start gap-3 rounded-[1.2rem] border border-amber-200 bg-amber-50 p-4">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            You started {currentShift.lateMinutes} minutes late today.
          </p>
        </div>
      )}

      {/* Service Selection */}
      {!currentShift && myServices.length > 0 && (
        <div className="mb-6 rounded-[1.2rem] border border-border/60 bg-muted/45 p-4">
          <label className="mb-2 block text-sm font-semibold text-foreground">
            Service Context (optional)
          </label>
          <select
            value={selectedServiceId || ''}
            onChange={(e) => setSelectedServiceId(e.target.value ? Number(e.target.value) : null)}
            disabled={loading}
            className="w-full rounded-xl border border-input/80 bg-background/90 p-2.5 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">No specific service</option>
            {myServices.map((service) => (
              <option key={service.serviceId} value={service.serviceId}>
                {service.clientName} - {service.serviceName}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-muted-foreground">
            Select the client/service you're working on. Leave empty for general work (notifications go to default channel).
          </p>
        </div>
      )}

      {!currentShift && (
        <div className="mb-6">
          <label className="mb-2 block text-sm font-semibold text-foreground">
            Shift Note (optional)
          </label>
          <textarea
            value={shiftNote}
            onChange={(e) => setShiftNote(e.target.value)}
            disabled={loading}
            placeholder="Optional note (e.g. started 40 mins ago)..."
            rows={2}
            className="w-full resize-none rounded-xl border border-input/80 bg-background/90 p-2.5 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}

      {currentShift && selectedServiceId && (
        <div className="mb-4 px-1">
          <p className="text-sm font-medium text-muted-foreground">
            Current Service: <span className="text-primary font-semibold">
              {myServices.find(s => s.serviceId === selectedServiceId)?.clientName} - {myServices.find(s => s.serviceId === selectedServiceId)?.serviceName}
            </span>
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {!currentShift ? (
          <button
            onClick={handleStartShift}
            disabled={loading || hasTeamMember === false || hasTeamMember === null}
            className="col-span-full flex h-32 flex-col items-center justify-center gap-3 rounded-[1.4rem] bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-[0_26px_48px_-20px_rgba(16,185,129,0.55)] transition-all duration-200 hover:from-emerald-600 hover:to-teal-700 hover:-translate-y-0.5 hover:shadow-[0_30px_54px_-18px_rgba(16,185,129,0.6)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Play className="w-12 h-12" fill="currentColor" />
            <span className="text-2xl font-bold">Start Shift</span>
          </button>
        ) : (
          <>
            <button
              onClick={handleEndShift}
              disabled={loading}
              className="flex h-32 flex-col items-center justify-center gap-3 rounded-[1.4rem] bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-[0_26px_48px_-20px_rgba(244,63,94,0.55)] transition-all duration-200 hover:from-rose-600 hover:to-red-700 hover:-translate-y-0.5 hover:shadow-[0_30px_54px_-18px_rgba(244,63,94,0.6)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Square className="w-12 h-12" fill="currentColor" />
              <span className="text-xl font-bold">End Shift</span>
            </button>

            {!activeBreak ? (
              <button
                onClick={handleStartBreak}
                disabled={loading}
                className="flex h-32 flex-col items-center justify-center gap-3 rounded-[1.4rem] bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-[0_26px_48px_-20px_rgba(245,158,11,0.55)] transition-all duration-200 hover:from-amber-600 hover:to-orange-700 hover:-translate-y-0.5 hover:shadow-[0_30px_54px_-18px_rgba(245,158,11,0.6)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Coffee className="w-12 h-12" />
                <span className="text-xl font-bold">Start Break</span>
              </button>
            ) : (
              <button
                onClick={handleEndBreak}
                disabled={loading}
                className="flex h-32 flex-col items-center justify-center gap-3 rounded-[1.4rem] bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_26px_48px_-20px_rgba(14,165,233,0.55)] transition-all duration-200 hover:from-sky-600 hover:to-blue-700 hover:-translate-y-0.5 hover:shadow-[0_30px_54px_-18px_rgba(14,165,233,0.6)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Coffee className="w-12 h-12" />
                <span className="text-xl font-bold">End Break</span>
                <span className="text-sm opacity-90">
                  {getDuration(activeBreak.startTime)}
                </span>
              </button>
            )}

            <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-[1.4rem] border border-white/80 bg-gradient-to-br from-slate-50 to-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
              <div className="text-sm font-medium uppercase text-muted-foreground">Status</div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${activeBreak ? 'bg-amber-500 animate-pulse' : 'bg-green-500 animate-pulse'
                  }`} />
                <span className="text-xl font-bold text-foreground">
                  {activeBreak ? 'On Break' : 'Working'}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {currentShift && (
        <div className="mt-6 border-t border-border/60 pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="mb-1 text-sm text-muted-foreground">Shift Start</div>
              <div className="text-lg font-semibold text-foreground">
                {formatTime(currentShift.startTime)}
              </div>
            </div>
            <div>
              <div className="mb-1 text-sm text-muted-foreground">Status</div>
              <div className="flex items-center justify-center gap-2">
                <div className={`w-2 h-2 rounded-full ${currentShift.status === 'on_break' ? 'bg-amber-500' : 'bg-green-500'
                  }`} />
                <span className="text-lg font-semibold text-foreground capitalize">
                  {currentShift.status === 'on_break' ? 'On Break' : 'Active'}
                </span>
              </div>
            </div>
            <div>
              <div className="mb-1 text-sm text-muted-foreground">Duration</div>
              <div className="text-lg font-semibold text-foreground">
                {getDuration(currentShift.startTime)}
              </div>
            </div>
            <div>
              <div className="mb-1 text-sm text-muted-foreground">Breaks Taken</div>
              <div className="text-lg font-semibold text-foreground">
                {activeBreak ? '1+' : '0'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
