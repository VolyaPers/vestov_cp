import { useCallback, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock, Coffee, AlertTriangle, Calendar, Users, TrendingUp } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useShiftEvents, useShiftUpdateListener } from '@/hooks/useSocket'
import { PreferredShiftsDisplay } from '@/components/PreferredShiftsDisplay'

interface Shift {
  id: number
  employeeId: number
  startTime: string
  endTime: string | null
  status: 'active' | 'on_break' | 'completed'
  isLate: boolean
  lateMinutes: number
  employee: {
    id: number
    name: string
    email: string
    avatarUrl?: string
  }
  activeBreak?: {
    id: number
    startTime: string
  }
}

export function AdminShifts() {
  // Connect to WebSocket for real-time updates
  useShiftEvents()

  const { data: activeShiftsData, isLoading: isLoadingActive, refetch: refetchActive } = useQuery({
    queryKey: ['adminActiveShifts'],
    queryFn: () => api.getAdminActiveShifts(),
    refetchInterval: 5 * 60 * 1000, // Fallback: refresh every 5 minutes
  })

  const { data: lateShiftsData, isLoading: isLoadingLate, refetch: refetchLate } = useQuery({
    queryKey: ['adminLateShifts'],
    queryFn: () => api.getAdminLateShifts(),
    refetchInterval: 5 * 60 * 1000, // Fallback: refresh every 5 minutes
  })

  // Store refetch functions in refs to avoid stale closures
  const refetchActiveRef = useRef(refetchActive)
  const refetchLateRef = useRef(refetchLate)

  useEffect(() => {
    refetchActiveRef.current = refetchActive
    refetchLateRef.current = refetchLate
  }, [refetchActive, refetchLate])

  // Listen for socket shift updates and force refetch using refs
  const handleShiftUpdate = useCallback(() => {
    refetchActiveRef.current()
    refetchLateRef.current()
  }, [])

  useShiftUpdateListener(handleShiftUpdate)

  const { data: preferredShiftsData, isLoading: isLoadingPreferred } = useQuery({
    queryKey: ['allPreferredShifts'],
    queryFn: () => api.getAllPreferredShifts(),
    refetchInterval: 5 * 60 * 1000,
  })

  const activeShifts: Shift[] = activeShiftsData?.shifts ?? []
  const lateShifts = lateShiftsData?.lateShifts ?? []
  const missedShifts = lateShiftsData?.missedShifts ?? []
  const preferredMembers = preferredShiftsData?.members ?? []
  const loading = isLoadingActive || isLoadingLate

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

  const workingNow = activeShifts.filter(s => s.status === 'active')
  const onBreak = activeShifts.filter(s => s.status === 'on_break')

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Clock className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading shift data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Section - Stripe style */}
      <div className="stripe-card p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold stripe-text-primary mb-2">
              Shift Management
            </h1>
            <p className="stripe-text-secondary text-lg">
              Monitor and manage employee shifts in real-time
            </p>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="stripe-stat-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Currently Working</p>
              <p className="text-3xl font-bold text-green-600">{workingNow.length}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
              <Users className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="stripe-stat-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">On Break</p>
              <p className="text-3xl font-bold text-amber-600">{onBreak.length}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
              <Coffee className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>

        <div className="stripe-stat-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Late Today</p>
              <p className="text-3xl font-bold text-red-600">{lateShifts.length}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="stripe-stat-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Missed Shifts</p>
              <p className="text-3xl font-bold text-orange-600">{missedShifts.length}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Active Shifts - Card Grid */}
      <div>
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            Active Shifts ({activeShifts.length})
          </h2>
          <p className="text-sm text-gray-600 mt-1">Employees currently working or on break</p>
        </div>

        {activeShifts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {activeShifts.map((shift) => (
              <Card
                key={shift.id}
                className={`overflow-hidden transition-all hover:shadow-lg ${
                  shift.status === 'on_break'
                    ? 'border-amber-200 bg-amber-50/30'
                    : 'border-green-200 bg-green-50/30'
                }`}
              >
                <CardContent className="p-4">
                  {/* Avatar and Name */}
                  <div className="flex items-start gap-3 mb-4">
                    <div className="relative">
                      <Avatar className="h-14 w-14 border-2 border-white shadow-md">
                        <AvatarImage src={shift.employee.avatarUrl} alt={shift.employee.name} />
                        <AvatarFallback className={`font-semibold ${
                          shift.status === 'on_break'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {shift.employee.name
                            .split(' ')
                            .map((n: string) => n[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white ${
                        shift.status === 'on_break' ? 'bg-amber-500 animate-pulse' : 'bg-green-500 animate-pulse'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{shift.employee.name}</h3>
                      <p className="text-xs text-gray-600 truncate">{shift.employee.email}</p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="mb-3">
                    {shift.status === 'on_break' && shift.activeBreak ? (
                      <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 w-full justify-center">
                        <Coffee className="w-3 h-3 mr-1" />
                        On Break ({getDuration(shift.activeBreak.startTime)})
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 w-full justify-center">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        Working
                      </Badge>
                    )}
                  </div>

                  {/* Time Info */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Started</span>
                      <span className="font-semibold text-gray-900">{formatTime(shift.startTime)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Duration</span>
                      <span className="font-semibold text-gray-900">{getDuration(shift.startTime)}</span>
                    </div>
                  </div>

                  {/* Late Badge */}
                  {shift.isLate && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <Badge variant="destructive" className="w-full justify-center">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Late {shift.lateMinutes}min
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-gray-500">
                <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No active shifts at the moment</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Team Preferred Shifts */}
      <div>
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            Team Preferred Shifts
          </h2>
          <p className="text-sm text-gray-600 mt-1">Preferred working hours for each team member (shown in your timezone)</p>
        </div>

        {isLoadingPreferred ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-gray-500">Loading preferred shifts...</div>
            </CardContent>
          </Card>
        ) : preferredMembers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {preferredMembers.map((item: any) => (
              <Card key={item.employee.id} className="border-gray-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                      <AvatarImage src={item.employee.avatarUrl} alt={item.employee.name} />
                      <AvatarFallback className="bg-indigo-100 text-indigo-700 font-semibold text-sm">
                        {item.employee.name
                          .split(' ')
                          .map((n: string) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-sm font-semibold">{item.employee.name}</CardTitle>
                      {item.employee.timezone && (
                        <CardDescription className="text-xs">{item.employee.timezone}</CardDescription>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <PreferredShiftsDisplay
                    schedules={item.schedules}
                    employeeTimezone={item.employee.timezone}
                    showEmployeeTime={true}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No team members have set preferred shifts yet</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Late/Missed Shifts */}
      {(lateShifts.length > 0 || missedShifts.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Late Shifts */}
          {lateShifts.length > 0 && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="w-5 h-5" />
                  Late Arrivals Today
                </CardTitle>
                <CardDescription>Employees who started late</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {lateShifts.map(({ shift, employee }: any) => (
                    <div
                      key={shift.id}
                      className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border-2 border-red-200">
                          <AvatarImage src={employee.avatarUrl} alt={employee.name} />
                          <AvatarFallback className="bg-red-100 text-red-700 font-semibold text-sm">
                            {employee.name
                              .split(' ')
                              .map((n: string) => n[0])
                              .join('')
                              .toUpperCase()
                              .slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-gray-900">{employee.name}</p>
                          <p className="text-sm text-gray-600">
                            Started at {formatTime(shift.startTime)}
                          </p>
                        </div>
                      </div>
                      <Badge variant="destructive">
                        {shift.lateMinutes} min late
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Missed Shifts */}
          {missedShifts.length > 0 && (
            <Card className="border-orange-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-700">
                  <Calendar className="w-5 h-5" />
                  Missed Shifts Today
                </CardTitle>
                <CardDescription>Scheduled employees who haven't started</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {missedShifts.map(({ schedule, employee }: any) => (
                    <div
                      key={`${employee.id}-${schedule.id}`}
                      className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border-2 border-orange-200">
                          <AvatarImage src={employee.avatarUrl} alt={employee.name} />
                          <AvatarFallback className="bg-orange-100 text-orange-700 font-semibold text-sm">
                            {employee.name
                              .split(' ')
                              .map((n: string) => n[0])
                              .join('')
                              .toUpperCase()
                              .slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-gray-900">{employee.name}</p>
                          <p className="text-sm text-gray-600">
                            Scheduled at {schedule.startTime}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
                        Not Started
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
