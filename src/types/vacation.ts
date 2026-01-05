import type { LeaveRequest as BaseLeaveRequest, TeamMember, LeaveType } from '@/types/common'

/**
 * API response structure for leave requests - includes nested request object
 * The backend returns requests in this nested format
 */
export interface LeaveRequestApiResponse {
  request: {
    id: number
    employeeId: number
    leaveTypeId: number
    status: string
    startDate: string
    endDate: string
    halfDayStart: boolean
    halfDayEnd: boolean
    daysCount: string
    reason: string | null
    decisionReason: string | null
    createdAt: string
  }
  employee?: {
    id: number
    name: string
    email: string
    avatarUrl?: string
  }
  leaveType?: {
    id: number
    name: string
  }
  requestedBy: {
    id: number
    username: string
    fullName: string
  }
}

/**
 * Extended LeaveRequest type for VacationPage
 * Combines base type with API response structure
 */
export type LeaveRequestWithNested = BaseLeaveRequest & LeaveRequestApiResponse

