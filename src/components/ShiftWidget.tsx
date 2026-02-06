import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Clock, Coffee, Info, Loader2, Play, Square } from 'lucide-react'
import { api } from '../lib/api'
import { useShiftEvents, useShiftUpdateListener } from '../hooks/useSocket'
import { useCustomAlert } from './ui/custom-alert'

interface Shift {
  id: number
  startTime: string
  status: 'active' | 'on_break'
  isLate: boolean
  lateMinutes: number
}

interface ShiftBreak {
  id: number
  startTime: string
}

interface UserService {
  serviceId: number
  serviceName: string
  clientName: string
  employmentType: 'fulltime' | 'part_time'
  workSchedule: Record<string, string>
  serviceTitle: string | null
  slackChannelId: string | null
}

type ConfirmAction = 'startShift' | 'endShift' | 'startBreak' | 'endBreak'

export function ShiftWidget() {
  const { showAlert } = useCustomAlert()
  const [currentShift, setCurrentShift] = useState<Shift | null>(null)
  const [activeBreak, setActiveBreak] = useState<ShiftBreak | null>(null)
  const [loading, setLoading] = useState(false)
  const [breakNote, setBreakNote] = useState('')
  const [shiftNote, setShiftNote] = useState('')
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const holdTimer = useRef<number | null>(null)
  const holdTriggered = useRef(false)
  const [holdAction, setHoldAction] = useState<ConfirmAction | null>(null)
  const [holdProgress, setHoldProgress] = useState(0)
  const [showInfoCard, setShowInfoCard] = useState(true)
  const progressInterval = useRef<number | null>(null)
  const holdStartTime = useRef<number | null>(null)
  const [myServices, setMyServices] = useState<UserService[]>([])
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null)

  // WebSocket connection for real-time shift updates
  useShiftEvents()

  const fetchCurrentShift = useCallback(async () => {
    try {
      const response = await api.getCurrentShift()
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
      console.error('Error fetching shift:', err)
    }
  }, [])

  // Listen for WebSocket shift events and refetch
  useShiftUpdateListener(fetchCurrentShift)

  useEffect(() => {
    const fetchMyServices = async () => {
      try {
        const response = await api.getMyServices()
        setMyServices(response.services)

        if (response.services.length === 1) {
          setSelectedServiceId(response.services[0].serviceId)
        } else if (response.services.length > 1) {
          // Detect current day and pre-select based on schedule
          const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
          const today = dayNames[new Date().getDay()]

          const scheduledService = response.services.find(s =>
            s.workSchedule && s.workSchedule[today] && s.workSchedule[today] !== 'off'
          )

          if (scheduledService) {
            setSelectedServiceId(scheduledService.serviceId)
          }
        }
      } catch (err) {
        console.error('Error fetching my services:', err)
      }
    }

    fetchCurrentShift()
    fetchMyServices()
    const interval = setInterval(fetchCurrentShift, 5 * 60 * 1000) // 5 min fallback (WebSocket handles real-time)
    return () => {
      clearInterval(interval)
      if (holdTimer.current) clearTimeout(holdTimer.current)
      if (progressInterval.current) clearInterval(progressInterval.current)
    }
  }, [fetchCurrentShift])

  const handleStartShift = async () => {
    setLoading(true)
    // Service selection is optional - users can start shifts without selecting a service
    // Notifications will go to the default channel if no service is selected

    try {
      const note = shiftNote?.trim() || ''
      const response = await api.startShift(selectedServiceId || undefined, note || undefined)
      setCurrentShift(response.shift)
      setShiftNote('')
      setConfirmAction(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start shift'
      showAlert({ message: errorMessage, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleStartBreakConfirm = async () => {
    setLoading(true)
    try {
      const note = breakNote?.trim() || ''
      const payload = { description: note }
      const response = await api.startBreak(payload)
      setActiveBreak(response.break)
      if (currentShift) setCurrentShift({ ...currentShift, status: 'on_break' })
      setBreakNote('')
      setConfirmAction(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start break'
      showAlert({ message: errorMessage, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleEndBreakConfirm = async () => {
    setLoading(true)
    try {
      await api.endBreak()
      setActiveBreak(null)
      if (currentShift) setCurrentShift({ ...currentShift, status: 'active' })
      setConfirmAction(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to end break'
      showAlert({ message: errorMessage, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleEndShiftConfirm = async () => {
    setLoading(true)
    try {
      await api.endShift()
      setCurrentShift(null)
      setActiveBreak(null)
      setConfirmAction(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to end shift'
      showAlert({ message: errorMessage, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const runAction = async (action: ConfirmAction) => {
    if (loading) return
    switch (action) {
      case 'startShift':
        await handleStartShift()
        break
      case 'endShift':
        await handleEndShiftConfirm()
        break
      case 'startBreak':
        await handleStartBreakConfirm()
        break
      case 'endBreak':
        await handleEndBreakConfirm()
        break
      default:
        break
    }
  }

  const startHold = (action: ConfirmAction) => {
    if (loading) return
    holdTriggered.current = false
    setHoldAction(action)
    setHoldProgress(0)
    const startTime = Date.now()
    holdStartTime.current = startTime

    // Update progress every 50ms for smooth animation
    progressInterval.current = window.setInterval(() => {
      const elapsed = Date.now() - startTime
      const progress = Math.min((elapsed / 3000) * 100, 100)
      setHoldProgress(progress)
    }, 50)

    holdTimer.current = window.setTimeout(async () => {
      holdTriggered.current = true
      setHoldAction(null)
      setHoldProgress(0)
      setConfirmAction(null)
      if (progressInterval.current) {
        clearInterval(progressInterval.current)
        progressInterval.current = null
      }
      holdStartTime.current = null
      await runAction(action)
    }, 3000)
  }

  const cancelHold = (action: ConfirmAction) => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
    if (progressInterval.current) {
      clearInterval(progressInterval.current)
      progressInterval.current = null
    }
    setHoldAction(null)
    setHoldProgress(0)
    holdStartTime.current = null
    if (!holdTriggered.current && !loading) {
      setConfirmAction(action)
    }
  }

  const actionLabel = (action: ConfirmAction) => {
    switch (action) {
      case 'startShift':
        return 'Do you wish to start your shift?'
      case 'endShift':
        return 'Do you wish to end your shift?'
      case 'startBreak':
        return 'Do you wish to start your break?'
      case 'endBreak':
        return 'Do you wish to end your break?'
      default:
        return ''
    }
  }

  const confirmButtons = (
    <div className="flex gap-2 mt-3">
      <button
        onClick={async () => {
          if (!confirmAction) return
          await runAction(confirmAction)
        }}
        disabled={loading}
        className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-semibold shadow-sm disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Yes'}
      </button>
      <button
        onClick={() => setConfirmAction(null)}
        disabled={loading}
        className="flex-1 py-2 border border-gray-300 rounded-md text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
      >
        No
      </button>
    </div>
  )

  const getDuration = (start: string) => {
    const diff = Date.now() - new Date(start).getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  }

  const mainAction = useMemo<ConfirmAction>(() => {
    return currentShift ? (activeBreak ? 'endBreak' : 'startBreak') : 'startShift'
  }, [currentShift, activeBreak])

  return (
    <div className="p-4 border-t border-gray-200 space-y-3">
      {/* Info Card */}
      {showInfoCard && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2 text-amber-800 relative">
          <Info className="w-4 h-4 mt-0.5" />
          <div className="text-sm leading-tight pr-6">
            Click once to confirm, or click and hold for 3s to perform the action faster.
          </div>
          <button
            type="button"
            aria-label="Dismiss info"
            onClick={() => setShowInfoCard(false)}
            className="absolute top-2 right-2 text-amber-700 hover:text-amber-900 transition-colors"
          >
            ×
          </button>
        </div>
      )}

      {/* Service Selection */}
      {!currentShift && myServices.length > 0 && (
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Service Context
          </label>
          <select
            value={selectedServiceId || ''}
            onChange={(e) => setSelectedServiceId(e.target.value ? Number(e.target.value) : null)}
            disabled={loading}
            className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          >
            <option value="">No specific service</option>
            {myServices.map((service) => (
              <option key={service.serviceId} value={service.serviceId}>
                {service.clientName} - {service.serviceTitle || service.serviceName} {service.serviceTitle ? `(${service.serviceName})` : ''}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-gray-500 mt-1">
            Optional - notifications go to default channel if not selected
          </p>
        </div>
      )}

      {currentShift && selectedServiceId && (
        <div className="px-1 py-0.5">
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-tight">
            Active Context: <span className="text-blue-600">
              {(() => {
                const s = myServices.find(s => s.serviceId === selectedServiceId);
                if (!s) return 'Unknown';
                const title = s.serviceTitle || s.serviceName;
                return `${s.clientName} - ${title}${s.serviceTitle ? ` (${s.serviceName})` : ''}`;
              })()}
            </span>
          </p>
        </div>
      )}

      {/* Status Bar (only when on shift) */}
      {currentShift && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${activeBreak ? 'bg-amber-500 animate-pulse' : 'bg-green-500 animate-pulse'
                  }`}
              />
              <span className="text-sm font-semibold text-gray-700">
                {activeBreak ? 'On Break' : 'Working'}
              </span>
            </div>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xs text-gray-600">
            <div className="flex justify-between">
              <span>Shift:</span>
              <span className="font-semibold">{getDuration(currentShift.startTime)}</span>
            </div>
            {activeBreak && (
              <div className="flex justify-between mt-1">
                <span>Break:</span>
                <span className="font-semibold">{getDuration(activeBreak.startTime)}</span>
              </div>
            )}
            {currentShift.isLate && (
              <div className="mt-2 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
                Late by {currentShift.lateMinutes}min
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <button
            onMouseDown={() => startHold(mainAction)}
            onMouseUp={() => cancelHold(mainAction)}
            onMouseLeave={() => {
              if (holdTimer.current) cancelHold(mainAction)
            }}
            onTouchStart={() => startHold(mainAction)}
            onTouchEnd={() => cancelHold(mainAction)}
            disabled={loading}
            aria-label={
              holdAction === mainAction
                ? `Holding to ${currentShift ? (activeBreak ? 'end break' : 'start break') : 'start shift'}... ${Math.round(holdProgress)}%`
                : currentShift
                  ? activeBreak
                    ? 'End break'
                    : 'Start break'
                  : 'Start shift'
            }
            className={`flex-1 py-2 rounded-lg font-medium text-sm shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 relative overflow-hidden ${activeBreak
              ? 'bg-blue-500 hover:bg-blue-600 text-white'
              : currentShift
                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
          >
            {holdAction === mainAction && (
              <div
                role="progressbar"
                aria-valuenow={Math.round(holdProgress)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Hold progress"
                className="absolute inset-0 bg-black/30 transition-all duration-50 ease-linear"
                style={{ width: `${holdProgress}%` }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1">
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  {currentShift ? <Coffee className="w-4 h-4" /> : <Play className="w-4 h-4" fill="currentColor" />}
                  <span>
                    {currentShift ? (activeBreak ? 'End Break' : 'Break') : 'Start Shift'}
                  </span>
                </>
              )}
            </span>
          </button>
          <button
            onMouseDown={() => startHold('endShift')}
            onMouseUp={() => cancelHold('endShift')}
            onMouseLeave={() => {
              if (holdTimer.current) cancelHold('endShift')
            }}
            onTouchStart={() => startHold('endShift')}
            onTouchEnd={() => cancelHold('endShift')}
            disabled={loading || !currentShift}
            aria-label={
              holdAction === 'endShift'
                ? `Holding to end shift... ${Math.round(holdProgress)}%`
                : 'End shift'
            }
            className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium text-sm shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 relative overflow-hidden"
          >
            {holdAction === 'endShift' && (
              <div
                role="progressbar"
                aria-valuenow={Math.round(holdProgress)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Hold progress"
                className="absolute inset-0 bg-black/30 transition-all duration-50 ease-linear"
                style={{ width: `${holdProgress}%` }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1">
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Square className="w-4 h-4" fill="currentColor" />
                  <span>End</span>
                </>
              )}
            </span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-lg shadow-xl p-4 max-w-md w-full border border-amber-200">
            <div className="text-base font-semibold text-gray-900">{actionLabel(confirmAction)}</div>
            {confirmAction === 'startShift' && (
              <textarea
                className="mt-3 w-full rounded-lg border border-amber-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Optional note (e.g. started 40 mins ago)..."
                value={shiftNote}
                onChange={(e) => setShiftNote(e.target.value)}
                rows={2}
                disabled={loading}
              />
            )}
            {confirmAction === 'startBreak' && (
              <textarea
                className="mt-3 w-full rounded-lg border border-amber-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Optional break note (e.g. lunch, quick call)..."
                value={breakNote}
                onChange={(e) => setBreakNote(e.target.value)}
                rows={3}
                disabled={loading}
              />
            )}
            {confirmButtons}
          </div>
        </div>
      )}
    </div>
  )
}
