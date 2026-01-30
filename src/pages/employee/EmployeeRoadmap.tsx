import { useState, useEffect } from 'react'
import { Calendar, DollarSign, Gift, TrendingUp, Award, CheckCircle, Lock, GraduationCap, Laptop, BookOpen } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { api } from '@/lib/api'

interface RoadmapData {
  currentYear: number
  startDate: string
  yearsAtCompany: number
  daysUntilNextMilestone: number
  nextMilestoneDate: string
  nextMilestoneYear: number
  currentVacationDays: number
  currentReimbursementLimit: number
}

interface Milestone {
  year: number
  vacationDays: number
  reimbursementLimit: number
  isUnlocked: boolean
  isNext: boolean
  isCurrent: boolean
}

export function EmployeeRoadmap() {
  const [data, setData] = useState<RoadmapData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRoadmapData()
  }, [])

  const loadRoadmapData = async () => {
    try {
      const roadmapData = await api.request('/roadmap')
      setData(roadmapData)
    } catch (error) {
      console.error('Error loading roadmap:', error)
    } finally {
      setLoading(false)
    }
  }

  const getMilestones = (): Milestone[] => {
    if (!data) return []

    const milestones = [
      { year: 1, vacationDays: 16, reimbursementLimit: 300 },
      { year: 2, vacationDays: 20, reimbursementLimit: 400 },
      { year: 3, vacationDays: 24, reimbursementLimit: 500 },
      { year: 4, vacationDays: 24, reimbursementLimit: 600 },
      { year: 5, vacationDays: 24, reimbursementLimit: 700 },
    ]

    return milestones.map(m => ({
      ...m,
      isUnlocked: data.yearsAtCompany >= m.year,
      isCurrent: data.yearsAtCompany === m.year,
      isNext: data.yearsAtCompany + 1 === m.year
    }))
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const calculateProgress = () => {
    if (!data) return 0
    const totalYears = 5 // Show up to 5 years
    return Math.min((data.yearsAtCompany / totalYears) * 100, 100)
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
        <p className="text-gray-500">Unable to load roadmap data</p>
      </div>
    )
  }

  const milestones = getMilestones()

  return (
    <div className="space-y-6">
      {/* Header Section - Stripe style */}
      <div className="stripe-card p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold stripe-text-primary mb-2">
              Your Career Roadmap at Vestov
            </h1>
            <p className="stripe-text-secondary text-lg">
              Track your journey and see what benefits await
            </p>
          </div>
        </div>
      </div>

      {/* Current Status Card */}
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-6 h-6 text-blue-600" />
            You're in {data.yearsAtCompany >= 5 ? 'Year 5+' : `Year ${data.yearsAtCompany}`}!
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-sm text-gray-600 mb-1">Started at Vestov</div>
              <div className="text-lg font-bold text-gray-900">{formatDate(data.startDate)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Current Benefits</div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold">{data.currentVacationDays} vacation days/year</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  <span className="font-semibold">${data.currentReimbursementLimit} reimbursement/year</span>
                </div>
              </div>
            </div>
            {data.yearsAtCompany < 5 && (
              <div>
                <div className="text-sm text-gray-600 mb-1">Next Milestone</div>
                <div className="text-lg font-bold text-blue-600">
                  Year {data.nextMilestoneYear} in {data.daysUntilNextMilestone} days
                </div>
                <div className="text-sm text-gray-500">
                  {formatDate(data.nextMilestoneDate)}
                </div>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="mt-6">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
              <span>Your Progress</span>
              <span>{data.yearsAtCompany >= 5 ? 'Year 5+' : `${data.yearsAtCompany} / 5 years`}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-500"
                style={{ width: `${calculateProgress()}%` }}
              ></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Permanent Benefits - Available from Day 1 */}
      <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="w-6 h-6 text-green-600" />
            Always Available Benefits
          </CardTitle>
          <CardDescription>
            These benefits are available to you from day one and throughout your entire career at Vestov
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* English Classes */}
            <div className="bg-white rounded-lg p-6 border-2 border-green-100 hover:border-green-300 transition-all">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">English Classes</h3>
                  <p className="text-sm text-gray-600">
                    Full coverage of English language courses to improve your professional communication skills
                  </p>
                  <div className="mt-3 inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                    <CheckCircle className="w-3 h-3" />
                    100% Covered
                  </div>
                </div>
              </div>
            </div>

            {/* Work Tools */}
            <div className="bg-white rounded-lg p-6 border-2 border-green-100 hover:border-green-300 transition-all">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <Laptop className="w-6 h-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Work Tools Coverage</h3>
                  <p className="text-sm text-gray-600">
                    All necessary software, subscriptions, and tools required for your work are fully covered
                  </p>
                  <div className="mt-3 inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                    <CheckCircle className="w-3 h-3" />
                    100% Covered
                  </div>
                </div>
              </div>
            </div>

            {/* Professional Education */}
            <div className="bg-white rounded-lg p-6 border-2 border-green-100 hover:border-green-300 transition-all">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <GraduationCap className="w-6 h-6 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Professional Education</h3>
                  <p className="text-sm text-gray-600">
                    Partial or full coverage of professional courses, certifications, and educational programs
                  </p>
                  <div className="mt-3 inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                    <CheckCircle className="w-3 h-3" />
                    Partial/Full Coverage
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-white border-2 border-green-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Award className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  These benefits are permanent and don't require any years of service
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Contact your manager or HR to learn more about eligibility criteria and how to take advantage of these benefits.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Benefits Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            Benefits Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>

            {/* Milestones */}
            <div className="space-y-8">
              {milestones.map((milestone) => (
                <div key={milestone.year} className="relative flex items-start gap-4">
                  {/* Timeline Dot */}
                  <div className="relative z-10">
                    {milestone.isUnlocked ? (
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                        milestone.isCurrent
                          ? 'bg-gradient-to-br from-blue-500 to-indigo-600 ring-4 ring-blue-100'
                          : 'bg-green-500'
                      }`}>
                        {milestone.isCurrent ? (
                          <Award className="w-8 h-8 text-white" />
                        ) : (
                          <CheckCircle className="w-8 h-8 text-white" />
                        )}
                      </div>
                    ) : (
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                        milestone.isNext
                          ? 'bg-blue-100 ring-4 ring-blue-50'
                          : 'bg-gray-100'
                      }`}>
                        {milestone.isNext ? (
                          <Gift className="w-8 h-8 text-blue-600" />
                        ) : (
                          <Lock className="w-8 h-8 text-gray-400" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Milestone Content */}
                  <div className={`flex-1 pb-8 ${
                    milestone.isUnlocked ? '' : 'opacity-60'
                  }`}>
                    <div className={`p-6 rounded-lg border-2 ${
                      milestone.isCurrent
                        ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-300'
                        : milestone.isNext
                        ? 'bg-blue-50 border-blue-200'
                        : milestone.isUnlocked
                        ? 'bg-green-50 border-green-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className={`text-xl font-bold ${
                          milestone.isCurrent ? 'text-blue-900' : 'text-gray-900'
                        }`}>
                          {milestone.year === 5 && data.yearsAtCompany >= 5 ? 'Year 5+' : `Year ${milestone.year}`}
                          {milestone.isCurrent && (
                            <span className="ml-3 text-sm font-normal px-3 py-1 bg-blue-600 text-white rounded-full">
                              You are here
                            </span>
                          )}
                          {milestone.isNext && (
                            <span className="ml-3 text-sm font-normal px-3 py-1 bg-blue-200 text-blue-900 rounded-full">
                              Coming up!
                            </span>
                          )}
                          {milestone.isUnlocked && !milestone.isCurrent && (
                            <span className="ml-3 text-sm font-normal px-3 py-1 bg-green-600 text-white rounded-full">
                              Unlocked
                            </span>
                          )}
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-3 p-4 bg-white rounded-lg">
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                            milestone.isUnlocked ? 'bg-blue-100' : 'bg-gray-100'
                          }`}>
                            <Calendar className={`w-6 h-6 ${
                              milestone.isUnlocked ? 'text-blue-600' : 'text-gray-400'
                            }`} />
                          </div>
                          <div>
                            <div className="text-sm text-gray-600">Vacation Days</div>
                            <div className="text-2xl font-bold text-gray-900">
                              {milestone.vacationDays}
                              {milestone.year > 1 && (
                                <span className="text-sm text-green-600 ml-2">
                                  +{milestone.vacationDays - milestones[milestone.year - 2].vacationDays}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 p-4 bg-white rounded-lg">
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                            milestone.isUnlocked ? 'bg-green-100' : 'bg-gray-100'
                          }`}>
                            <DollarSign className={`w-6 h-6 ${
                              milestone.isUnlocked ? 'text-green-600' : 'text-gray-400'
                            }`} />
                          </div>
                          <div>
                            <div className="text-sm text-gray-600">Reimbursement</div>
                            <div className="text-2xl font-bold text-gray-900">
                              ${milestone.reimbursementLimit}
                              {milestone.year > 1 && (
                                <span className="text-sm text-green-600 ml-2">
                                  +${milestone.reimbursementLimit - milestones[milestone.year - 2].reimbursementLimit}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {milestone.year === 5 && (
                        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <div className="flex items-center gap-2 text-sm text-yellow-800">
                            <Award className="w-4 h-4" />
                            <span className="font-semibold">Maximum benefits reached! These continue for all future years.</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
