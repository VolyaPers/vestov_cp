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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Link } from 'wouter'
import { api } from '@/lib/api'

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

  useEffect(() => {
    loadDashboardData()
    const timer = setInterval(() => setCurrentTime(new Date()), 60000) // Update every minute
    return () => clearInterval(timer)
  }, [])

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

      // Calculate vacation stats
      const approvedVacations = vacationRequests.filter((v: any) => v.status === 'approved')
      const pendingVacations = vacationRequests.filter((v: any) => v.status === 'pending')
      const upcomingVacations = approvedVacations.filter((v: any) =>
        new Date(v.startDate) > new Date()
      )

      let vacationDaysUsed = 0
      approvedVacations.forEach((vacation: any) => {
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

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg p-8 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {getGreeting()}, {data.profile.name.split(' ')[0]}! 👋
            </h1>
            <p className="text-blue-100 text-lg">
              You're in {data.roadmap.yearsAtCompany >= 5 ? 'Year 5+' : `Year ${data.roadmap.yearsAtCompany}`} at Vestov
            </p>
          </div>
          <div className="text-right">
            <p className="text-blue-100 text-sm">
              {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
            <p className="text-2xl font-semibold mt-1">{formatTime(currentTime)}</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Vacation Days */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <Badge variant="outline" className="text-xs">
                {data.vacations.pending} pending
              </Badge>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-600">Vacation Days</p>
              <p className="text-3xl font-bold text-gray-900">
                {vacationRemaining} <span className="text-lg text-gray-500">/ {data.roadmap.currentVacationDays}</span>
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(vacationProgress, 100)}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500">{Math.round(100 - vacationProgress)}% remaining</p>
            </div>
          </CardContent>
        </Card>

        {/* Reimbursement Budget */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <Badge variant="outline" className="text-xs">
                {data.reimbursements.pending} pending
              </Badge>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-600">Reimbursement Budget</p>
              <p className="text-xs text-gray-500">Available for use:</p>
              <p className="text-3xl font-bold text-gray-900">
                ${reimbursementRemaining} <span className="text-lg text-gray-500">/ ${data.roadmap.currentReimbursementLimit}</span>
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(reimbursementProgress, 100)}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500">{Math.round(100 - reimbursementProgress)}% remaining</p>
            </div>
          </CardContent>
        </Card>

        {/* Current Year */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-600">Career Year</p>
              <p className="text-3xl font-bold text-gray-900">
                {data.roadmap.yearsAtCompany >= 5 ? 'Year 5+' : `Year ${data.roadmap.yearsAtCompany}`}
              </p>
              <p className="text-sm text-gray-600">
                Started {formatDate(data.profile.startDate)}
              </p>
              <Link href="/employee/roadmap">
                <a className="text-xs text-purple-600 hover:text-purple-700 font-medium inline-flex items-center gap-1">
                  View roadmap <ArrowRight className="w-3 h-3" />
                </a>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Next Milestone */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center">
                <Award className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-600">Next Milestone</p>
              {data.roadmap.yearsAtCompany < 5 ? (
                <>
                  <p className="text-3xl font-bold text-gray-900">
                    Year {data.roadmap.nextMilestoneYear}
                  </p>
                  <p className="text-sm text-gray-600">
                    <Clock className="w-3 h-3 inline mr-1" />
                    In {data.roadmap.daysUntilNextMilestone} days
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDate(data.roadmap.nextMilestoneDate)}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-gray-900">
                    Max Level! 🎉
                  </p>
                  <p className="text-sm text-gray-600">
                    You've reached maximum benefits
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-blue-600" />
            Quick Actions
          </CardTitle>
          <CardDescription>Access frequently used features</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/employee/vacations">
              <a className="block">
                <Button className="w-full h-24 bg-blue-600 hover:bg-blue-700 text-white flex flex-col items-center justify-center gap-2">
                  <Calendar className="w-8 h-8" />
                  <span className="font-semibold">Request Vacation</span>
                </Button>
              </a>
            </Link>
            <Link href="/employee/reimbursements">
              <a className="block">
                <Button className="w-full h-24 bg-green-600 hover:bg-green-700 text-white flex flex-col items-center justify-center gap-2">
                  <DollarSign className="w-8 h-8" />
                  <span className="font-semibold">Submit Reimbursement</span>
                </Button>
              </a>
            </Link>
            <Link href="/employee/roadmap">
              <a className="block">
                <Button className="w-full h-24 bg-purple-600 hover:bg-purple-700 text-white flex flex-col items-center justify-center gap-2">
                  <TrendingUp className="w-8 h-8" />
                  <span className="font-semibold">View Roadmap</span>
                </Button>
              </a>
            </Link>
            <Link href="/employee/profile">
              <a className="block">
                <Button className="w-full h-24 bg-gray-600 hover:bg-gray-700 text-white flex flex-col items-center justify-center gap-2">
                  <User className="w-8 h-8" />
                  <span className="font-semibold">Update Profile</span>
                </Button>
              </a>
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Recent Activity
            </CardTitle>
            <CardDescription>Your latest requests and updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.vacations.recent.slice(0, 3).map((vacation) => (
                <div key={`vacation-${vacation.id}`} className="flex items-start gap-3 pb-3 border-b last:border-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-gray-900">Vacation Request</p>
                      <Badge className={getStatusColor(vacation.status)}>
                        {vacation.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {formatDate(vacation.startDate)} - {formatDate(vacation.endDate)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Requested {formatDate(vacation.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
              {data.reimbursements.recent.slice(0, 2).map((reimbursement) => (
                <div key={`reimb-${reimbursement.id}`} className="flex items-start gap-3 pb-3 border-b last:border-0">
                  <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                    <DollarSign className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-gray-900">Reimbursement</p>
                      <Badge className={getStatusColor(reimbursement.status)}>
                        {reimbursement.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      ${reimbursement.reimbursementAmount} - {reimbursement.description}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Submitted {formatDate(reimbursement.requestedAt)}
                    </p>
                  </div>
                </div>
              ))}
              {data.vacations.recent.length === 0 && data.reimbursements.recent.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">No recent activity</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Vacations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Upcoming Vacations
            </CardTitle>
            <CardDescription>Your approved time off</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.vacations.upcoming.length > 0 ? (
                data.vacations.upcoming.map((vacation) => {
                  const daysUntil = Math.ceil((new Date(vacation.startDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                  return (
                    <div key={vacation.id} className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {formatDate(vacation.startDate)} - {formatDate(vacation.endDate)}
                          </p>
                          <p className="text-xs text-gray-600 mt-1 capitalize">
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
                  <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No upcoming vacations</p>
                  <Link href="/employee/vacations">
                    <a className="text-xs text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1 mt-2">
                      Request time off <ArrowRight className="w-3 h-3" />
                    </a>
                  </Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Benefits Summary */}
      <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-green-600" />
            Your Benefits at a Glance
          </CardTitle>
          <CardDescription>Everything you have access to at Vestov</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-green-100">
              <BookOpen className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-900">English Classes</p>
                <p className="text-xs text-gray-600">100% Covered</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-green-100">
              <Laptop className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-gray-900">Work Tools</p>
                <p className="text-xs text-gray-600">100% Covered</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-green-100">
              <GraduationCap className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-gray-900">Professional Education</p>
                <p className="text-xs text-gray-600">Partial/Full Coverage</p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-green-200">
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
