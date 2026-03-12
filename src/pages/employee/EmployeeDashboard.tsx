import { useState, useEffect } from 'react'
import {
  Calendar,
  DollarSign,
  TrendingUp,
  Clock,
  PlusCircle,
  User,
  Award,
  CheckCircle,
  Gift,
  BookOpen,
  Laptop,
  GraduationCap,
  ArrowRight
} from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Link } from 'wouter'
import { api } from '@/lib/api'
import { PreferredShiftsEditor } from '@/components/PreferredShiftsEditor'
import { TimezoneSelect } from '@/components/TimezoneSelect'
import { Label } from '@/components/ui/label'
import type { ShiftSchedule } from '@/types/common'
import { EmptyState, MetricTile, PageHero, SectionHeading } from '@/components/page-primitives'

interface DashboardData {
  profile: {
    id: number
    name: string
    email: string
    role: string
    startDate: string
  }
  roadmap: {
    yearsAtCompany: number
    currentVacationDays: number
    currentReimbursementLimit: number
    nextMilestoneYear: number
    daysUntilNextMilestone: number
    nextMilestoneDate: string
  }
  vacations: {
    used: number
    pending: number
    upcoming: Array<{
      id: number
      startDate: string
      endDate: string
      status: string
      type: string
    }>
    recent: Array<{
      id: number
      startDate: string
      endDate: string
      status: string
      type: string
      createdAt: string
    }>
  }
  reimbursements: {
    used: number
    pending: number
    recent: Array<{
      id: number
      reimbursementAmount: string
      status: string
      description: string
      requestedAt: string
    }>
  }
}

export function EmployeeDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [preferredShifts, setPreferredShifts] = useState<ShiftSchedule[]>([])
  const [shiftTimezone, setShiftTimezone] = useState<string | null>(null)
  const [savingShifts, setSavingShifts] = useState(false)
  const [savingTimezone, setSavingTimezone] = useState(false)

  useEffect(() => {
    loadDashboardData()
    loadPreferredShifts()
    const timer = setInterval(() => setCurrentTime(new Date()), 60000) // Update every minute
    return () => clearInterval(timer)
  }, [])

  const loadPreferredShifts = async () => {
    try {
      const result = await api.getMyPreferredShifts()
      setPreferredShifts(result.schedules || [])
      setShiftTimezone(result.timezone || null)
    } catch (error) {
      console.error('Error loading preferred shifts:', error)
    }
  }

  const handleSaveShifts = async (schedules: ShiftSchedule[]) => {
    try {
      setSavingShifts(true)
      const result = await api.updateMyPreferredShifts(
        schedules.map((s) => ({
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          isActive: s.isActive,
        }))
      )
      setPreferredShifts(result.schedules || [])
    } catch (error) {
      console.error('Error saving preferred shifts:', error)
    } finally {
      setSavingShifts(false)
    }
  }

  const handleTimezoneChange = async (timezone: string) => {
    try {
      setSavingTimezone(true)
      setShiftTimezone(timezone)
      await api.request('/shifts/timezone/me', {
        method: 'PUT',
        body: JSON.stringify({ timezone }),
      })
    } catch (error) {
      console.error('Error updating timezone:', error)
    } finally {
      setSavingTimezone(false)
    }
  }

  const loadDashboardData = async () => {
    try {
      setLoading(true)

      // Load all data in parallel
      const [profile, roadmap, vacationRequests, reimbursementData] = await Promise.all([
        api.request('/vacation/my-profile'),
        api.request('/roadmap'),
        api.request('/vacation/my-requests'),
        api.request('/reimbursements/my-requests')
      ])

      // Handle case where reimbursements might be empty array
      const reimbursements = Array.isArray(reimbursementData) ? reimbursementData : []

      // Calculate vacation stats - only count actual vacation requests, not sick leave
      const isVacationType = (type: string) => /^(vacation|annual leave|paid time off|pto)$/i.test(type)
      const approvedVacations = vacationRequests.filter((v: any) => v.status === 'approved')
      const pendingVacations = vacationRequests.filter((v: any) => v.status === 'pending')
      const upcomingVacations = approvedVacations.filter((v: any) =>
        new Date(v.startDate) > new Date()
      )

      let vacationDaysUsed = 0
      approvedVacations
        .filter((v: any) => isVacationType(v.type))
        .forEach((vacation: any) => {
          const start = new Date(vacation.startDate)
          const end = new Date(vacation.endDate)
          const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
          vacationDaysUsed += days
        })

      // Calculate reimbursement stats - only count reimbursements from current career year
      // If careerYear is null (migration not run yet), count all approved reimbursements
      const currentCareerYear = roadmap.yearsAtCompany
      const currentYearReimbursements = reimbursements.filter((r: any) => {
        // If careerYear is null/undefined, include all (fallback for before migration)
        if (r.careerYear === null || r.careerYear === undefined) {
          return true
        }
        return r.careerYear === currentCareerYear
      })
      const approvedReimbursements = currentYearReimbursements.filter((r: any) => r.status === 'approved' || r.status === 'confirmed')
      const pendingReimbursements = currentYearReimbursements.filter((r: any) => r.status === 'pending')
      const reimbursementUsed = approvedReimbursements.reduce((sum: number, r: any) => sum + parseFloat(r.reimbursementAmount || '0'), 0)

      setData({
        profile: {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          role: profile.role,
          startDate: profile.startDate
        },
        roadmap,
        vacations: {
          used: vacationDaysUsed,
          pending: pendingVacations.length,
          upcoming: upcomingVacations.slice(0, 3),
          recent: vacationRequests.slice(0, 5)
        },
        reimbursements: {
          used: reimbursementUsed,
          pending: pendingReimbursements.length,
          recent: reimbursements.slice(0, 5)
        }
      })
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const getGreeting = () => {
    const hour = currentTime.getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      case 'paid': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Unable to load dashboard data</p>
      </div>
    )
  }

  const vacationRemaining = data.roadmap.currentVacationDays - data.vacations.used
  const vacationProgress = (data.vacations.used / data.roadmap.currentVacationDays) * 100
  const reimbursementRemaining = data.roadmap.currentReimbursementLimit - data.reimbursements.used
  const reimbursementProgress = (data.reimbursements.used / data.roadmap.currentReimbursementLimit) * 100
  const yearLabel = data.roadmap.yearsAtCompany >= 5 ? 'Year 5+' : `Year ${data.roadmap.yearsAtCompany}`

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHero
        eyebrow="Employee Dashboard"
        title={`${getGreeting()}, ${data.profile.name.split(' ')[0]}.`}
        description={`You are currently in ${yearLabel} at Vestov. This workspace now matches the refreshed shell with stronger hierarchy across benefits, planning and daily operations.`}
        theme="teal"
        meta={
          <>
            <span>{currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
            <span className="h-1 w-1 rounded-full bg-slate-300"></span>
            <span>{formatTime(currentTime)}</span>
            <span className="h-1 w-1 rounded-full bg-slate-300"></span>
            <span>{data.vacations.pending} pending vacation requests</span>
          </>
        }
        aside={
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
            <div className="hero-aside-card sm:rounded-[1.3rem] sm:p-4">
              <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-muted-foreground">Career year</p>
              <p className="mt-2.5 font-display text-xl font-semibold text-foreground sm:mt-3 sm:text-2xl">{yearLabel}</p>
              <p className="mt-1 text-sm text-muted-foreground">Started {formatDate(data.profile.startDate)}</p>
            </div>
            <div className="hero-aside-card sm:rounded-[1.3rem] sm:p-4">
              <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-muted-foreground">Next milestone</p>
              <p className="mt-2.5 font-display text-xl font-semibold text-foreground sm:mt-3 sm:text-2xl">
                {data.roadmap.yearsAtCompany < 5 ? `Year ${data.roadmap.nextMilestoneYear}` : 'Max level'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {data.roadmap.yearsAtCompany < 5 ? `In ${data.roadmap.daysUntilNextMilestone} days` : 'Maximum benefits unlocked'}
              </p>
            </div>
          </div>
        }
      />

      <div className="-mx-1 flex snap-x snap-mandatory gap-3 px-1 pb-1 touch-scroll-x sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible lg:grid-cols-4">
        <div className="min-w-[15.5rem] shrink-0 snap-start sm:min-w-0">
          <MetricTile
            label="Vacation Days"
            value={<>{vacationRemaining} <span className="text-lg text-muted-foreground">/ {data.roadmap.currentVacationDays}</span></>}
            hint={<>{Math.round(100 - vacationProgress)}% remaining</>}
            trend={<Badge variant="outline" className="text-xs">{data.vacations.pending} pending</Badge>}
            icon={<Calendar className="w-5 h-5" />}
            tone="primary"
          />
        </div>
        <div className="min-w-[15.5rem] shrink-0 snap-start sm:min-w-0">
          <MetricTile
            label="Reimbursement Budget"
            value={<>{`$${reimbursementRemaining}`} <span className="text-lg text-muted-foreground">/ ${data.roadmap.currentReimbursementLimit}</span></>}
            hint={`${Math.round(100 - reimbursementProgress)}% remaining`}
            trend={<Badge variant="outline" className="text-xs">{data.reimbursements.pending} pending</Badge>}
            icon={<DollarSign className="w-5 h-5" />}
            tone="emerald"
          />
        </div>
        <div className="min-w-[15.5rem] shrink-0 snap-start sm:min-w-0">
          <MetricTile
            label="Career Year"
            value={yearLabel}
            hint={`Started ${formatDate(data.profile.startDate)}`}
            trend={
              <Link href="/employee/roadmap">
                <a className="inline-flex items-center gap-1 text-xs font-semibold text-primary no-underline hover:no-underline">
                  View roadmap <ArrowRight className="w-3 h-3" />
                </a>
              </Link>
            }
            icon={<TrendingUp className="w-5 h-5" />}
            tone="violet"
          />
        </div>
        <div className="min-w-[15.5rem] shrink-0 snap-start sm:min-w-0">
          <MetricTile
            label="Next Milestone"
            value={data.roadmap.yearsAtCompany < 5 ? `Year ${data.roadmap.nextMilestoneYear}` : 'Max level'}
            hint={data.roadmap.yearsAtCompany < 5 ? `In ${data.roadmap.daysUntilNextMilestone} days` : `You've reached maximum benefits`}
            trend={data.roadmap.yearsAtCompany < 5 ? <span className="text-xs text-muted-foreground">{formatDate(data.roadmap.nextMilestoneDate)}</span> : undefined}
            icon={<Award className="w-5 h-5" />}
            tone="amber"
          />
        </div>
      </div>

      <Card className="content-auto">
        <CardHeader>
          <SectionHeading title="Quick Actions" description="Access frequently used features" icon={<PlusCircle className="w-5 h-5" />} />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Link href="/employee/vacations">
              <a className="block">
                <Button className="glass-action-button glass-action-button-blue flex h-20 w-full flex-col items-center justify-center gap-1.5 px-3 sm:h-24 sm:gap-2">
                  <Calendar className="h-6 w-6 sm:h-8 sm:w-8" />
                  <span className="text-xs font-semibold sm:text-sm">Request Vacation</span>
                </Button>
              </a>
            </Link>
            <Link href="/employee/reimbursements">
              <a className="block">
                <Button className="glass-action-button glass-action-button-emerald flex h-20 w-full flex-col items-center justify-center gap-1.5 px-3 sm:h-24 sm:gap-2">
                  <DollarSign className="h-6 w-6 sm:h-8 sm:w-8" />
                  <span className="text-xs font-semibold sm:text-sm">Submit Reimbursement</span>
                </Button>
              </a>
            </Link>
            <Link href="/employee/roadmap">
              <a className="block">
                <Button className="glass-action-button glass-action-button-violet flex h-20 w-full flex-col items-center justify-center gap-1.5 px-3 sm:h-24 sm:gap-2">
                  <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8" />
                  <span className="text-xs font-semibold sm:text-sm">View Roadmap</span>
                </Button>
              </a>
            </Link>
            <Link href="/employee/profile">
              <a className="block">
                <Button className="glass-action-button glass-action-button-slate flex h-20 w-full flex-col items-center justify-center gap-1.5 px-3 sm:h-24 sm:gap-2">
                  <User className="h-6 w-6 sm:h-8 sm:w-8" />
                  <span className="text-xs font-semibold sm:text-sm">Update Profile</span>
                </Button>
              </a>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card className="relative z-10">
        <CardHeader>
          <SectionHeading title="My Preferred Shifts" description="Set your preferred working hours for each day" icon={<Clock className="w-5 h-5" />} />
        </CardHeader>
        <CardContent>
          {!shiftTimezone ? (
            <div className="space-y-4">
              <div className="rounded-[1.2rem] border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm text-amber-800 font-medium">Please set your timezone first</p>
                <p className="text-xs text-amber-600 mt-1">Your timezone is needed to correctly display shift times to others</p>
              </div>
              <div className="space-y-2 max-w-sm">
                <Label className="text-sm font-medium text-foreground">Your Timezone</Label>
                <TimezoneSelect
                  value={shiftTimezone || undefined}
                  onChange={handleTimezoneChange}
                  disabled={savingTimezone}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex max-w-sm flex-col items-start gap-3 sm:flex-row sm:items-center">
                <Label className="whitespace-nowrap text-sm font-medium text-foreground">Timezone:</Label>
                <TimezoneSelect
                  value={shiftTimezone}
                  onChange={handleTimezoneChange}
                  disabled={savingTimezone}
                />
              </div>
              <PreferredShiftsEditor
                schedules={preferredShifts}
                onSave={handleSaveShifts}
                isSaving={savingShifts}
                timezone={shiftTimezone}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <Card className="content-auto">
          <CardHeader>
            <SectionHeading title="Recent Activity" description="Your latest requests and updates" icon={<Clock className="w-5 h-5" />} />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.vacations.recent.slice(0, 3).map((vacation) => {
                const isSick = /sick/i.test(vacation.type)
                return (
                <div key={`vacation-${vacation.id}`} className="flex items-start gap-3 pb-3 border-b last:border-0">
                  <div className={`w-8 h-8 rounded-lg ${isSick ? 'bg-orange-100' : 'bg-blue-100'} flex items-center justify-center flex-shrink-0`}>
                    <Calendar className={`w-4 h-4 ${isSick ? 'text-orange-600' : 'text-blue-600'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{vacation.type} Request</p>
                      <Badge className={getStatusColor(vacation.status)}>
                        {vacation.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(vacation.startDate)} - {formatDate(vacation.endDate)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Requested {formatDate(vacation.createdAt)}
                    </p>
                  </div>
                </div>
                )
              })}
              {data.reimbursements.recent.slice(0, 2).map((reimbursement) => (
                <div key={`reimb-${reimbursement.id}`} className="flex items-start gap-3 pb-3 border-b last:border-0">
                  <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                    <DollarSign className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">Reimbursement</p>
                      <Badge className={getStatusColor(reimbursement.status)}>
                        {reimbursement.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      ${reimbursement.reimbursementAmount} - {reimbursement.description}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Submitted {formatDate(reimbursement.requestedAt)}
                    </p>
                  </div>
                </div>
              ))}
              {data.vacations.recent.length === 0 && data.reimbursements.recent.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">No recent activity</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Vacations */}
        <Card className="content-auto">
          <CardHeader>
            <SectionHeading title="Upcoming Vacations" description="Your approved time off" icon={<Calendar className="w-5 h-5" />} />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.vacations.upcoming.length > 0 ? (
                data.vacations.upcoming.map((vacation) => {
                  const daysUntil = Math.ceil((new Date(vacation.startDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                  return (
                    <div key={vacation.id} className="rounded-[1rem] border border-sky-200 bg-sky-50 p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {formatDate(vacation.startDate)} - {formatDate(vacation.endDate)}
                          </p>
                          <p className="mt-1 text-xs capitalize text-muted-foreground">
                            {vacation.type.replace('_', ' ')}
                          </p>
                        </div>
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Approved
                        </Badge>
                      </div>
                      <p className="text-xs text-blue-600 font-medium mt-2">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {daysUntil > 0 ? `In ${daysUntil} days` : 'Starting soon'}
                      </p>
                    </div>
                  )
                })
              ) : (
                <div className="text-center py-8">
                  <Calendar className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No upcoming vacations</p>
                  <Link href="/employee/vacations">
                    <a className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 no-underline hover:text-blue-700 hover:no-underline">
                      Request time off <ArrowRight className="w-3 h-3" />
                    </a>
                  </Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-tint-emerald content-auto">
        <CardHeader>
          <SectionHeading title="Your Benefits at a Glance" description="Everything you have access to at Vestov" icon={<Gift className="w-5 h-5" />} />
        </CardHeader>
        <CardContent>
          <div className="mb-5 grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3 rounded-lg border border-white/80 bg-white/78 p-3">
              <BookOpen className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-900">English Classes</p>
                <p className="text-xs text-gray-600">100% Covered</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-white/80 bg-white/78 p-3">
              <Laptop className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-gray-900">Work Tools</p>
                <p className="text-xs text-gray-600">100% Covered</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-white/80 bg-white/78 p-3">
              <GraduationCap className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-gray-900">Professional Education</p>
                <p className="text-xs text-gray-600">Partial/Full Coverage</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-start gap-4 rounded-lg border border-white/80 bg-white/82 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Current Year Benefits: <span className="text-blue-600">{data.roadmap.currentVacationDays} vacation days</span> • <span className="text-green-600">${data.roadmap.currentReimbursementLimit} reimbursement</span>
              </p>
              <p className="text-xs text-gray-600 mt-1">
                See your complete career progression and future benefits
              </p>
            </div>
            <Link href="/employee/roadmap">
              <a>
                <Button variant="outline" className="flex items-center gap-2">
                  View Full Roadmap <ArrowRight className="w-4 h-4" />
                </Button>
              </a>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
