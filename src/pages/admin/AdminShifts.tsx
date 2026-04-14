import { useCallback, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock, Coffee, AlertTriangle, Calendar, Users, TrendingUp } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useShiftEvents, useShiftUpdateListener } from '@/hooks/useSocket'
import { PreferredShiftsDisplay } from '@/components/PreferredShiftsDisplay'
import { CardSkeleton, EmptyState, MetricTile, MetricTileSkeleton, PageHero, PageHeroSkeleton, SectionHeading } from '@/components/page-primitives'

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
      <div className="space-y-6">
        <PageHeroSkeleton />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <MetricTileSkeleton key={index} />
          ))}
        </div>
        <CardSkeleton titleWidth="w-44" lines={4} />
        <CardSkeleton titleWidth="w-40" lines={4} />
        <div className="grid gap-6 lg:grid-cols-2">
          <CardSkeleton titleWidth="w-40" lines={4} tall />
          <CardSkeleton titleWidth="w-40" lines={4} tall />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Operations"
        title="Shift control center"
        description="Track live shift activity, preferred schedules, and attendance exceptions from one operational workspace."
        theme="ocean"
        meta={(
          <>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
              {activeShifts.length} active sessions
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
              {lateShifts.length + missedShifts.length} attendance alerts
            </span>
          </>
        )}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Working"
          value={workingNow.length}
          hint="Currently clocked in"
          icon={<Users className="h-5 w-5" />}
          tone="emerald"
        />
        <MetricTile
          label="On Break"
          value={onBreak.length}
          hint="Live break sessions"
          icon={<Coffee className="h-5 w-5" />}
          tone="amber"
        />
        <MetricTile
          label="Late Today"
          value={lateShifts.length}
          hint="Started behind schedule"
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="rose"
        />
        <MetricTile
          label="Missed Starts"
          value={missedShifts.length}
          hint="Scheduled but not started"
          icon={<Calendar className="h-5 w-5" />}
          tone="violet"
        />
      </div>

      <div>
        <SectionHeading
          title={`Active shifts (${activeShifts.length})`}
          description="Employees currently working or on break."
          icon={<Clock className="h-5 w-5" />}
        />

        {activeShifts.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {activeShifts.map((shift) => (
              <Card
                key={shift.id}
                className={`overflow-hidden border-white/80 bg-white/92 shadow-[0_24px_50px_-36px_rgba(15,23,42,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_28px_60px_-34px_rgba(15,23,42,0.55)] ${
                  shift.status === 'on_break'
                    ? 'ring-1 ring-amber-200/70'
                    : 'ring-1 ring-emerald-200/70'
                }`}
              >
                <CardContent className="p-4">
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
                      <h3 className="truncate font-semibold text-foreground">{shift.employee.name}</h3>
                      <p className="truncate text-xs text-muted-foreground">{shift.employee.email}</p>
                    </div>
                  </div>

                  <div className="mb-3">
                    {shift.status === 'on_break' && shift.activeBreak ? (
                      <Badge variant="outline" className="w-full justify-center border-amber-300 bg-amber-100 text-amber-700">
                        <Coffee className="w-3 h-3 mr-1" />
                        On Break ({getDuration(shift.activeBreak.startTime)})
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="w-full justify-center border-emerald-300 bg-emerald-100 text-emerald-700">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        Working
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-2 rounded-[1rem] border border-border/60 bg-muted/20 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Started</span>
                      <span className="font-semibold text-foreground">{formatTime(shift.startTime)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Duration</span>
                      <span className="font-semibold text-foreground">{getDuration(shift.startTime)}</span>
                    </div>
                  </div>

                  {shift.isLate && (
                    <div className="mt-3 border-t border-border/70 pt-3">
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
          <EmptyState
            icon={<Clock className="h-6 w-6" />}
            title="No active shifts"
            description="Live shift sessions will appear here once employees clock in."
          />
        )}
      </div>

      <div>
        <SectionHeading
          title="Team preferred shifts"
          description="Preferred working hours for each team member in your timezone."
          icon={<Calendar className="h-5 w-5" />}
        />

        {isLoadingPreferred ? (
          <Card className="border-white/80 bg-white/88">
            <CardContent className="py-8 text-center text-muted-foreground">Loading preferred shifts...</CardContent>
          </Card>
        ) : preferredMembers.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {preferredMembers.map((item: any) => (
              <Card key={item.employee.id} className="border-white/80 bg-white/92">
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
          <EmptyState
            icon={<Calendar className="h-6 w-6" />}
            title="No preferred shifts yet"
            description="Preferred schedules will appear here after the team configures them."
          />
        )}
      </div>

      {(lateShifts.length > 0 || missedShifts.length > 0) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {lateShifts.length > 0 && (
            <Card className="border-rose-200/80 bg-white/92">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-rose-700">
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
                      className="flex items-center justify-between rounded-[1rem] border border-rose-200/80 bg-rose-50/85 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border-2 border-rose-200">
                          <AvatarImage src={employee.avatarUrl} alt={employee.name} />
                          <AvatarFallback className="bg-rose-100 text-rose-700 font-semibold text-sm">
                            {employee.name
                              .split(' ')
                              .map((n: string) => n[0])
                              .join('')
                              .toUpperCase()
                              .slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-foreground">{employee.name}</p>
                          <p className="text-sm text-muted-foreground">
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

          {missedShifts.length > 0 && (
            <Card className="border-amber-200/80 bg-white/92">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-700">
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
                      className="flex items-center justify-between rounded-[1rem] border border-amber-200/80 bg-amber-50/85 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border-2 border-amber-200">
                          <AvatarImage src={employee.avatarUrl} alt={employee.name} />
                          <AvatarFallback className="bg-amber-100 text-amber-700 font-semibold text-sm">
                            {employee.name
                              .split(' ')
                              .map((n: string) => n[0])
                              .join('')
                              .toUpperCase()
                              .slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-foreground">{employee.name}</p>
                          <p className="text-sm text-muted-foreground">
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
