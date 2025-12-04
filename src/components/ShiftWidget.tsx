import { useState, useEffect } from 'react'
import { Play, Square, Coffee, Clock, Loader2 } from 'lucide-react'
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

export function ShiftWidget() {
  const [currentShift, setCurrentShift] = useState<Shift | null>(null)
  const [activeBreak, setActiveBreak] = useState<ShiftBreak | null>(null)
  const [loading, setLoading] = useState(false)

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
    } catch (err: any) {
      alert(err.message || 'Failed to start shift')
    } finally {
      setLoading(false)
    }
  }

  const handleEndShift = async () => {
    if (!confirm('End your shift?')) return
    setLoading(true)
    try {
      await api.endShift()
      setCurrentShift(null)
      setActiveBreak(null)
    } catch (err: any) {
      alert(err.message || 'Failed to end shift')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleBreak = async () => {
    setLoading(true)
    try {
      if (activeBreak) {
        await api.endBreak()
        setActiveBreak(null)
        if (currentShift) setCurrentShift({ ...currentShift, status: 'active' })
      } else {
        const response = await api.startBreak()
        setActiveBreak(response.break)
        if (currentShift) setCurrentShift({ ...currentShift, status: 'on_break' })
      }
    } catch (err: any) {
      alert(err.message || 'Failed to toggle break')
    } finally {
      setLoading(false)
    }
  }

  const getDuration = (start: string) => {
    const diff = Date.now() - new Date(start).getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  }

  if (!currentShift) {
    return (
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={handleStartShift}
          disabled={loading}
          className="w-full py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Play className="w-5 h-5" fill="currentColor" />
              <span>Start Shift</span>
            </>
          )}
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 border-t border-gray-200 space-y-3">
      {/* Status Bar */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              activeBreak ? 'bg-amber-500 animate-pulse' : 'bg-green-500 animate-pulse'
            }`} />
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
        </div>
        {currentShift.isLate && (
          <div className="mt-2 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
            Late by {currentShift.lateMinutes}min
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleToggleBreak}
          disabled={loading}
          className={`flex-1 py-2 rounded-lg font-medium text-sm shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 ${
            activeBreak
              ? 'bg-blue-500 hover:bg-blue-600 text-white'
              : 'bg-amber-500 hover:bg-amber-600 text-white'
          }`}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Coffee className="w-4 h-4" />
              <span>{activeBreak ? 'End Break' : 'Break'}</span>
            </>
          )}
        </button>
        <button
          onClick={handleEndShift}
          disabled={loading}
          className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium text-sm shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
        >
          {loading ? (
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
  )
}
