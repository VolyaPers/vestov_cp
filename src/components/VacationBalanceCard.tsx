import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip } from '@/components/ui/tooltip'
import { Calendar, Lock, AlertCircle, Heart, Info, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface VacationBalance {
  // Totals
  totalAllocated: number
  totalUsed: number
  totalRemaining: number

  // First Half
  firstHalfAvailable: number
  firstHalfUsed: number
  firstHalfRemaining: number

  // Second Half
  secondHalfAvailable: number
  secondHalfUsed: number
  secondHalfRemaining: number

  // Currently Available (respects half boundaries)
  currentlyAvailable: number
  lockedUntilSecondHalf: number

  // Financial
  benefitFactor?: number
  cashableAtYearEnd: number
  allocationWarning?: string | null
  willExpire: number

  // Metadata
  isFirstHalf: boolean
  daysUntilSecondHalf: number
  cycleStartDate: string
  cycleMidpointDate: string
  cycleEndDate: string
  cycleId: number
  cycleNumber: number
  careerYear: number // Career year based on time at company (used for UI logic)
  baseAllocation: number
}

interface SickLeaveBalance {
  totalAllocated: number
  totalUsed: number
  totalRemaining: number
  cycleStartDate: string
  cycleEndDate: string
  cycleId: number
}

interface VacationBalanceCardProps {
  balance: VacationBalance | null
  isLoading?: boolean
  error?: Error | null
  employeeId?: number
  onReviewAllocation?: () => void
}

export function VacationBalanceCard({ balance, isLoading, error, employeeId, onReviewAllocation }: VacationBalanceCardProps) {
  // Fetch sick leave balance
  const { data: sickLeaveBalance, isLoading: sickLeaveLoading } = useQuery<SickLeaveBalance>({
    queryKey: ['sickLeaveBalance', employeeId ?? 'me'],
    queryFn: () => employeeId ? api.request(`/vacation/sick-leave-balance/${employeeId}`) : api.getMySickLeaveBalance(),
    enabled: !isLoading && !error && !!balance,
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Vacation Balance</CardTitle>
          <CardDescription>Loading balance...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    const errorMessage = error.message?.includes('No active employment cycle found')
      ? 'Please contact an administrator to set up your employment cycle.'
      : (error.message || 'Failed to load vacation balance')
    
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Error Loading Balance
          </CardTitle>
          <CardDescription>{errorMessage}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (!balance) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Vacation Balance</CardTitle>
          <CardDescription>Please contact an administrator to set up your employment cycle.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const formatDate = (dateStr: string) => {
    return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }

  // Use careerYear directly from balance - this is the source of truth
  // careerYear is calculated on the backend using 365-day calculation (calculateEmploymentMetrics)
  const careerYear = balance.careerYear ?? balance.cycleNumber ?? 1
  const isFirstYear = careerYear === 1

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Vacation Balance
            </CardTitle>
            <CardDescription>
              Cycle: {formatDate(balance.cycleStartDate)} - {formatDate(balance.cycleEndDate)}
            </CardDescription>
          </div>
          <Badge variant={balance.isFirstHalf ? 'default' : 'secondary'} className="text-sm">
            {balance.isFirstHalf ? 'First Half' : 'Second Half'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Available Now and Cycle Information - Combined Row */}
        <div className="grid grid-cols-4 gap-4 p-6 bg-primary/5 rounded-lg">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">Available Now</p>
            <p className="text-4xl font-bold text-primary">
              {balance.currentlyAvailable.toFixed(1)}
              <span className="text-lg text-muted-foreground ml-2">days</span>
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-2">Cycle Start</p>
            <p className="text-lg font-semibold">{formatDate(balance.cycleStartDate)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-2">Cycle End</p>
            <p className="text-lg font-semibold">{formatDate(balance.cycleEndDate)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-2">Days Until New Cycle</p>
            <p className="text-lg font-semibold text-primary">
              {careerYear >= 5 ? (
                '-'
              ) : (() => {
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                const cycleEnd = new Date(balance.cycleEndDate)
                cycleEnd.setHours(0, 0, 0, 0)
                // Next cycle starts the day after cycleEnd, so add 1 day
                const nextCycleStart = new Date(cycleEnd)
                nextCycleStart.setDate(nextCycleStart.getDate() + 1)
                const daysRemaining = Math.ceil((nextCycleStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                return Math.max(0, daysRemaining)
              })()}
            </p>
          </div>
        </div>

        {/* Educational Info About Vacation Policy */}
        {isFirstYear ? (
          // First Year: No 50/50 split
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-3">
              <Heart className="h-5 w-5 text-green-600 flex-shrink-0" />
              <div className="flex-1">
                <span className="font-semibold text-sm text-green-900 mr-2">First Year Flexibility</span>
                <span className="text-sm text-green-800">
                  Welcome! During your <strong>first year</strong>, you have <strong>full flexibility</strong> with your {balance.baseAllocation} vacation days.
                  You can use them anytime throughout your employment cycle - no restrictions!
                  <strong className="mt-2"> Starting your second year</strong>, the 50/50 split rule will apply to help you maintain work-life balance and prevent burnout.
                </span>
              </div>
            </div>
          </div>
        ) : (
          // Second Year+: 50/50 split applies
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-3">
              <Heart className="h-5 w-5 text-blue-600 flex-shrink-0" />
              <div className="flex-1">
                <span className="font-semibold text-sm text-blue-900 mr-2">Why the 50/50 Split?</span>
                <span className="text-sm text-blue-800">
                  Your vacation days are split into two halves to prioritize your <strong>health and wellbeing</strong>.
                  Taking regular breaks throughout the year helps prevent burnout and keeps you energized.
                  This approach also ensures <strong>business continuity</strong> by encouraging consistent time off
                  rather than long absences that can disrupt team workflow. It's about sustainable work-life balance
                  that benefits both you and the organization.
                </span>
              </div>
            </div>
          </div>
        )}
        {/* First Half / Second Half Breakdown */}
        {isFirstYear ? (
          // First Year: Show single card with all days available
          <div className="p-6 rounded-lg border-2 border-primary bg-primary/5">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-5 w-5 text-primary" />
              <p className="font-semibold text-lg">Annual Vacation Days</p>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-base">
                <span className="text-muted-foreground">Total Allocated:</span>
                <span className="font-semibold text-lg">{balance.totalAllocated.toFixed(1)} days</span>
              </div>
              <div className="flex justify-between text-base">
                <span className="text-muted-foreground">Used:</span>
                <span className="font-semibold text-lg">{balance.totalUsed.toFixed(1)} days</span>
              </div>
              <div className="flex justify-between text-base pt-3 border-t-2 border-primary/20">
                <span className="text-primary font-semibold">Available Anytime:</span>
                <span className="font-bold text-2xl text-primary">{balance.totalRemaining.toFixed(1)} days</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4 italic">
              Available throughout your entire employment cycle ({formatDate(balance.cycleStartDate)} - {formatDate(balance.cycleEndDate)})
            </p>
          </div>
        ) : (
          // Second Year+: Show 50/50 split
          <div className="grid grid-cols-2 gap-4">
            {/* First Half */}
            <div className={cn(
              "p-4 rounded-lg border-2",
              balance.isFirstHalf ? "border-primary bg-primary/5" : "border-gray-200 bg-gray-50"
            )}>
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <p className="font-semibold text-sm">First Half</p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Allocated:</span>
                  <span className="font-medium">{balance.firstHalfAvailable.toFixed(1)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Used:</span>
                  <span className="font-medium">{balance.firstHalfUsed.toFixed(1)}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t">
                  <span className="text-muted-foreground">Remaining:</span>
                  <span className="font-bold">{balance.firstHalfRemaining.toFixed(1)}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {formatDate(balance.cycleStartDate)} - {formatDate(balance.cycleMidpointDate)}
              </p>
            </div>

            {/* Second Half */}
            <div className={cn(
              "p-4 rounded-lg border-2",
              !balance.isFirstHalf ? "border-primary bg-primary/5" : "border-gray-200 bg-gray-50"
            )}>
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <p className="font-semibold text-sm">Second Half</p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Allocated:</span>
                  <span className="font-medium">{balance.secondHalfAvailable.toFixed(1)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Used:</span>
                  <span className="font-medium">{balance.secondHalfUsed.toFixed(1)}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t">
                  <span className="text-muted-foreground">Remaining:</span>
                  <span className="font-bold">{balance.secondHalfRemaining.toFixed(1)}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {formatDate(balance.cycleMidpointDate)} - {formatDate(balance.cycleEndDate)}
              </p>
            </div>
          </div>
        )}

        {/* Locked Days Warning and Financial Summary - Combined Row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Locked Days Warning (First Half Only) */}
          {balance.isFirstHalf && balance.lockedUntilSecondHalf > 0 ? (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <Lock className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-sm text-amber-900">
                  {balance.lockedUntilSecondHalf.toFixed(1)} days locked until second half
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  These days will unlock on {formatDate(balance.cycleMidpointDate)} ({balance.daysUntilSecondHalf} days remaining)
                </p>
              </div>
            </div>
          ) : null}

          {balance.allocationWarning && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><p>{balance.allocationWarning}</p></div>}
          {onReviewAllocation && <button type="button" className="text-sm font-semibold underline" onClick={onReviewAllocation}>Review individual allocation</button>}
          {/* Financial Summary */}
          <div className="p-4 bg-gray-50 rounded-lg space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <p className="font-semibold text-sm">Year-End Summary</p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Remaining:</span>
                <span className="font-medium">{balance.totalRemaining.toFixed(1)} days</span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="flex items-center gap-1 text-green-600">
                  Eligible for review (up to {5*(balance.benefitFactor ?? 1)}):
                  <Tooltip
                    content={`At cycle end, up to ${5*(balance.benefitFactor ?? 1)} unused days are eligible for compensation review. Payment requires an administrator to approve and record a salary adjustment; this display does not create a payment.`}
                    side="top"
                  >
                    <Info className="h-3.5 w-3.5 text-green-500 cursor-help" />
                  </Tooltip>
                </span>
                <span className="font-medium text-green-600">{balance.cashableAtYearEnd.toFixed(1)} days</span>
              </div>
              {balance.willExpire > 0 && (
                <div className="flex justify-between text-sm items-center">
                  <span className="flex items-center gap-1 text-red-600">
                    Will Expire:
                    <Tooltip
                      content="Unused days beyond the compensation eligibility limit expire at cycle end. Eligibility alone is not a recorded payment."
                      side="top"
                    >
                      <Info className="h-3.5 w-3.5 text-red-500 cursor-help" />
                    </Tooltip>
                  </span>
                  <span className="font-medium text-red-600">{balance.willExpire.toFixed(1)} days</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Total Summary */}
        <div className="pt-4 border-t">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">Total Allocated</p>
              <p className="text-2xl font-bold">{balance.totalAllocated.toFixed(1)} days</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total Used</p>
              <p className="text-2xl font-bold">{balance.totalUsed.toFixed(1)} days</p>
            </div>
          </div>
        </div>

        {/* Sick Leave Section */}
        {sickLeaveBalance && (
          <div className="mt-6 pt-6 border-t">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-lg">Sick Leave</h3>
              <Tooltip
                content="Sick leave is available throughout the entire employment cycle with no 50/50 split restriction. Your allocated days can be used at any time during the year."
                side="top"
              >
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </Tooltip>
            </div>

            {/* Sick Leave Available and Educational Info - Combined Row */}
            <div className="grid grid-cols-2 gap-4">
              {/* Sick Leave Available - Big Number */}
              <div className="text-center p-6 bg-blue-50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Sick Days Available</p>
                <p className="text-4xl font-bold text-blue-600">
                  {sickLeaveBalance.totalRemaining.toFixed(1)}
                  <span className="text-lg text-muted-foreground ml-2">days</span>
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  out of {sickLeaveBalance.totalAllocated} total
                </p>
              </div>

              {/* Educational Info About Sick Leave Flexibility */}
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
                <div className="flex items-center gap-3">
                  <Heart className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="font-semibold text-sm text-green-900 block mb-1">Full Cycle Availability</span>
                    <span className="text-sm text-green-800">
                      Unlike vacation days, <strong>all {sickLeaveBalance.totalAllocated} sick days are available anytime</strong> during your employment cycle
                      ({formatDate(sickLeaveBalance.cycleStartDate)} - {formatDate(sickLeaveBalance.cycleEndDate)}).
                      There are no first-half or second-half restrictions. Use them whenever you need for your health and recovery.
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {sickLeaveLoading && (
          <div className="mt-6 pt-6 border-t">
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              <span className="ml-2 text-sm text-muted-foreground">Loading sick leave...</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
