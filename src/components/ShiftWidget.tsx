import { useEffect, useRef, useState } from 'react'
import { Clock, Coffee, Info, Loader2, Play, Square } from 'lucide-react'
import { api } from '../lib/api'

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

type ConfirmAction = 'startShift' | 'endShift' | 'startBreak' | 'endBreak'

export function ShiftWidget() {
  const [currentShift, setCurrentShift] = useState<Shift | null>(null)
  const [activeBreak, setActiveBreak] = useState<ShiftBreak | null>(null)
  const [loading, setLoading] = useState(false)
  const [breakNote, setBreakNote] = useState('')
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const holdTimer = useRef<number | null>(null)
  const holdTriggered = useRef(false)
  const [holdAction, setHoldAction] = useState<ConfirmAction | null>(null)
  const [showInfoCard, setShowInfoCard] = useState(true)

  const fetchCurrentShift = async () => {
    try {
      const response = await api.getCurrentShift()
      if (response.hasActiveShift) {
        setCurrentShift(response.shift)
        setActiveBreak(response.activeBreak)
      } else {
        setCurrentShift(null)
        setActiveBreak(null)
      }
    } catch (err) {
      console.error('Error fetching shift:', err)
    }
  }

  useEffect(() => {
    fetchCurrentShift()
    const interval = setInterval(fetchCurrentShift, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleStartShift = async () => {
    setLoading(true)
    try {
      const response = await api.startShift()
      setCurrentShift(response.shift)
      setConfirmAction(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start shift'
      alert(errorMessage)
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
      alert(errorMessage)
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
      alert(errorMessage)
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
      alert(errorMessage)
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
    holdTimer.current = window.setTimeout(async () => {
      holdTriggered.current = true
      setHoldAction(null)
      setConfirmAction(null)
      await runAction(action)
    }, 3000)
  }

  const cancelHold = (action: ConfirmAction) => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
    setHoldAction(null)
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

  const mainAction: ConfirmAction = currentShift ? (activeBreak ? 'endBreak' : 'startBreak') : 'startShift'

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

      {/* Status Bar (only when on shift) */}
      {currentShift && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  activeBreak ? 'bg-amber-500 animate-pulse' : 'bg-green-500 animate-pulse'
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
            className={`flex-1 py-2 rounded-lg font-medium text-sm shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 ${
              activeBreak
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : currentShift
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {loading || holdAction === mainAction ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                {currentShift ? <Coffee className="w-4 h-4" /> : <Play className="w-4 h-4" fill="currentColor" />}
                <span>
                  {currentShift ? (activeBreak ? 'End Break' : 'Break') : 'Start Shift'}
                </span>
              </>
            )}
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
            className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium text-sm shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
          >
            {loading || holdAction === 'endShift' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Square className="w-4 h-4" fill="currentColor" />
                <span>End</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-lg shadow-xl p-4 max-w-md w-full border border-amber-200">
            <div className="text-base font-semibold text-gray-900">{actionLabel(confirmAction)}</div>
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
