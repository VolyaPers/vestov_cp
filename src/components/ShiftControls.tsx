import { useState, useEffect } from 'react'
import { Play, Square, Coffee, Clock, AlertCircle } from 'lucide-react'
import { api } from '../lib/api'

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
  employmentType: 'fulltime' | 'part_time'
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
  const [currentShift, setCurrentShift] = useState<Shift | null>(null)
  const [activeBreak, setActiveBreak] = useState<ShiftBreak | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [myServices, setMyServices] = useState<UserService[]>([])
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null)
  const [isFullTime, setIsFullTime] = useState(false)

  // Fetch current shift status
  const fetchCurrentShift = async () => {
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
  }

  const fetchMyServices = async () => {
    try {
      const response = await api.getMyServices()
      setMyServices(response.services)

      if (response.services.length === 1) {
        setSelectedServiceId(response.services[0].serviceId)
        setIsFullTime(response.services[0].employmentType === 'fulltime')
      } else if (response.services.length > 1) {
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

  useEffect(() => {
    fetchCurrentShift()
    fetchMyServices()
    // Refresh every 30 seconds
    const interval = setInterval(fetchCurrentShift, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleStartShift = async () => {
    setLoading(true)
    setError(null)

    if (!selectedServiceId && myServices.length > 0) {
      setError('Please select a service first')
      setLoading(false)
      return
    }

    try {
      const response = await api.startShift(selectedServiceId || undefined)
      setCurrentShift(response.shift)
      setActiveBreak(null)
    } catch (err: any) {
      setError(err.message || 'Failed to start shift')
    } finally {
      setLoading(false)
    }
  }

  const handleEndShift = async () => {
    if (!confirm('Are you sure you want to end your shift?')) return

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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Clock className="w-6 h-6 text-blue-600" />
          Shift Control
        </h2>
        {currentShift && (
          <div className="text-sm">
            <span className="text-gray-600">Started at </span>
            <span className="font-semibold text-gray-900">
              {formatTime(currentShift.startTime)}
            </span>
            <span className="text-gray-600 ml-3">Duration: </span>
            <span className="font-semibold text-gray-900">
              {getDuration(currentShift.startTime)}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {currentShift && currentShift.isLate && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            You started {currentShift.lateMinutes} minutes late today.
          </p>
        </div>
      )}

      {/* Service Selection */}
      {!currentShift && myServices.length > 0 && (
        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Select Service Context for Shift
          </label>
          {myServices.length > 1 ? (
            <select
              value={selectedServiceId || ''}
              onChange={(e) => setSelectedServiceId(Number(e.target.value))}
              disabled={loading}
              className="w-full p-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
            >
              <option value="" disabled>Choose a service...</option>
              {myServices.map((service) => (
                <option key={service.serviceId} value={service.serviceId}>
                  {service.clientName} - {service.serviceName}
                </option>
              ))}
            </select>
          ) : (
            <div className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="font-medium text-gray-900">{myServices[0].clientName}</span>
              <span className="text-gray-500">- {myServices[0].serviceName}</span>
            </div>
          )}
          <p className="mt-2 text-xs text-gray-500">
            This determines which client the shift is assigned to and where Slack notifications are sent.
          </p>
        </div>
      )}

      {currentShift && selectedServiceId && (
        <div className="mb-4 px-1">
          <p className="text-sm font-medium text-gray-500">
            Current Service: <span className="text-blue-600 font-semibold">
              {myServices.find(s => s.serviceId === selectedServiceId)?.clientName} - {myServices.find(s => s.serviceId === selectedServiceId)?.serviceName}
            </span>
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {!currentShift ? (
          <button
            onClick={handleStartShift}
            disabled={loading}
            className="col-span-full h-32 bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-3"
          >
            <Play className="w-12 h-12" fill="currentColor" />
            <span className="text-2xl font-bold">Start Shift</span>
          </button>
        ) : (
          <>
            <button
              onClick={handleEndShift}
              disabled={loading}
              className="h-32 bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-3"
            >
              <Square className="w-12 h-12" fill="currentColor" />
              <span className="text-xl font-bold">End Shift</span>
            </button>

            {!activeBreak ? (
              <button
                onClick={handleStartBreak}
                disabled={loading}
                className="h-32 bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-3"
              >
                <Coffee className="w-12 h-12" />
                <span className="text-xl font-bold">Start Break</span>
              </button>
            ) : (
              <button
                onClick={handleEndBreak}
                disabled={loading}
                className="h-32 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-3"
              >
                <Coffee className="w-12 h-12" />
                <span className="text-xl font-bold">End Break</span>
                <span className="text-sm opacity-90">
                  {getDuration(activeBreak.startTime)}
                </span>
              </button>
            )}

            <div className="h-32 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl shadow-inner flex flex-col items-center justify-center gap-2 border-2 border-gray-300">
              <div className="text-sm font-medium text-gray-600 uppercase">Status</div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${activeBreak ? 'bg-amber-500 animate-pulse' : 'bg-green-500 animate-pulse'
                  }`} />
                <span className="text-xl font-bold text-gray-900">
                  {activeBreak ? 'On Break' : 'Working'}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {currentShift && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-sm text-gray-600 mb-1">Shift Start</div>
              <div className="text-lg font-semibold text-gray-900">
                {formatTime(currentShift.startTime)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Status</div>
              <div className="flex items-center justify-center gap-2">
                <div className={`w-2 h-2 rounded-full ${currentShift.status === 'on_break' ? 'bg-amber-500' : 'bg-green-500'
                  }`} />
                <span className="text-lg font-semibold text-gray-900 capitalize">
                  {currentShift.status === 'on_break' ? 'On Break' : 'Active'}
                </span>
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Duration</div>
              <div className="text-lg font-semibold text-gray-900">
                {getDuration(currentShift.startTime)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Breaks Taken</div>
              <div className="text-lg font-semibold text-gray-900">
                {activeBreak ? '1+' : '0'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
