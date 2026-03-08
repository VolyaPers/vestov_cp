// Common types shared across the application

export type UserRole = 'admin' | 'team_member' | 'client'
export type AccessLevel = 'read' | 'write' | 'admin'
export type ClientStatus = 'active' | 'inactive' | 'prospect'
export type ContractType = 'outstaffing' | 'outsourcing' | 'hybrid'
export type BillingCycle = 'monthly' | 'weekly' | 'hourly'
export type EmploymentType = 'fulltime' | 'part_time' | 'freelancer'
export type TeamMemberStatus = 'active' | 'bench' | 'unavailable'
export type LeaveRequestStatus = 'pending' | 'approved' | 'denied' | 'cancelled'
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
export type ShiftStatus = 'active' | 'on_break'
export type GlobalSearchResultType = 'page' | 'user' | 'team_member' | 'client' | 'transaction'

export interface GlobalSearchResult {
  id: string
  type: GlobalSearchResultType
  title: string
  subtitle: string
  href: string
  badge: string
  meta?: string
  imageUrl?: string
  external?: boolean
}

export interface AdminGlobalSearchResponse {
  users: GlobalSearchResult[]
  teamMembers: GlobalSearchResult[]
  clients: GlobalSearchResult[]
  transactions: GlobalSearchResult[]
}

export interface LeaveType {
  id: number
  name: string
  maxDays?: number
  description?: string
}

export interface User {
  id: number
  username: string
  fullName: string
  email: string
  role: UserRole
  position?: string
  avatarUrl?: string
  timezone?: string
  teamMemberId?: number
  isActive: boolean
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
  // Impersonation fields
  isImpersonating?: boolean
  originalUser?: User
}

export interface Client {
  id: number
  name: string
  industry?: string
  contactPerson?: string
  email?: string
  phone?: string
  address?: string
  status: ClientStatus
  contractType?: ContractType
  contractStart?: string
  contractEnd?: string
  billingRate?: string
  billingCycle?: BillingCycle
  activeServices?: unknown
  teamSize?: number
  logoUrl?: string
  createdAt: string
  updatedAt: string
  services?: ClientService[]
  invoiceTotals?: {
    total: string
    paid: string
    pending: string
  }
  // Access level for client users (only present when user is a client)
  accessLevel?: AccessLevel
}

export interface ClientService {
  id: number
  serviceTypeId: number
  serviceType?: {
    id: number
    name: string
    category: 'outstaffing' | 'outsourcing'
    billingModel: 'hourly' | 'monthly' | 'fixed'
    description?: string
  }
  // Flattened fields from joins (frequently used by backend API)
  serviceTypeName?: string
  serviceDescription?: string
  serviceCategory?: 'outstaffing' | 'outsourcing'
  billingModel?: 'hourly' | 'monthly' | 'fixed'
  rate?: number
  serviceTitle?: string
  serviceLevelPrice?: number
  startDate: string
  endDate?: string
  slackChannelId?: string
  isActive: boolean
  createdAt?: string
}

export interface TeamMember {
  id: number
  name: string
  email: string
  position: string
  skills: string[]
  hourlyRate: number
  experienceLevel: 'junior' | 'middle' | 'senior' | 'lead'
  status: TeamMemberStatus
  employmentType?: EmploymentType
  isBillable?: boolean
  bio?: string
  location?: string
  timezone?: string
  clientId?: number
  createdAt?: string
  updatedAt?: string
}

export interface ShiftSchedule {
  id?: number
  employeeId?: number
  dayOfWeek: number  // 1=Monday ... 5=Friday
  startTime: string  // HH:MM in employee's timezone
  endTime: string    // HH:MM in employee's timezone
  isActive: boolean
}

export interface ShiftScheduleOverride {
  id?: number
  employeeId?: number
  overrideDate: string  // YYYY-MM-DD
  startTime: string     // HH:MM
  endTime: string       // HH:MM
  isDayOff: boolean
}

export interface LeaveRequest {
  id: number
  employeeId: number
  employee?: TeamMember
  leaveTypeId: number
  leaveType?: {
    id: number
    name: string
    maxDays?: number
    description?: string
  }
  status: LeaveRequestStatus
  startDate: string
  endDate: string
  halfDayStart: boolean
  halfDayEnd: boolean
  daysCount: string
  reason?: string
  requestedBy: number
  decisionBy?: number
  decisionAt?: string
  decisionReason?: string
  createdAt: string
  updatedAt: string
}

export interface ClientAssignment {
  assignmentId: number
  clientId: number
  clientName: string
  accessLevel: AccessLevel
  isActive: boolean
  assignedAt: string
}

export interface UserWithClientAssignments extends User {
  clientAssignments?: ClientAssignment[]
}

export interface Shift {
  id: number
  employeeId: number
  startTime: string
  endTime?: string
  status: ShiftStatus
  isLate: boolean
  lateMinutes: number
}

export interface ShiftBreak {
  id: number
  shiftId: number
  startTime: string
  endTime?: string
  description?: string
}

export interface ServiceDeveloper {
  id: number
  teamMemberId: number
  developer?: TeamMember
  employmentType: EmploymentType
  hourlyRate?: number
  fixedPrice?: number
  hoursWorked?: number
  startDate: string
  endDate?: string
  workSchedule?: Record<string, string>
}

export interface CreateClientData {
  name: string
  industry?: string
  contactPerson?: string
  email?: string
  phone?: string
  address?: string
  status?: ClientStatus
  contractType?: ContractType
  contractStart?: string
  contractEnd?: string
  billingRate?: string
  billingCycle?: BillingCycle
}

export interface UpdateClientData extends Partial<CreateClientData> {
  logoUrl?: string
}

export interface CreateTeamMemberData {
  userId?: number // Optional: if provided, links to existing user with role='team_member'
  name: string
  email: string
  phone?: string
  skills?: string[]
  bio?: string
  hourlyRate?: number
  monthlyRate?: number
  isBillable: boolean
  status: TeamMemberStatus
  startDate: string
  location?: string
  timezone?: string
  position: string
  employmentType?: EmploymentType
  experienceLevel?: 'junior' | 'middle' | 'senior' | 'lead'
  clientId?: number | null
}

export interface UpdateTeamMemberData extends Partial<CreateTeamMemberData> {
  startDate?: string
  phone?: string
  isBillable?: boolean
  showOnCalendar?: boolean
}

export interface CreateLeaveRequestData {
  employeeId: number
  leaveTypeId: number
  startDate: string
  endDate: string
  reason?: string
}

export interface UpdateLeaveRequestData extends Partial<CreateLeaveRequestData> {
  status?: LeaveRequestStatus
  decisionReason?: string
}

export interface CreateInvoiceData {
  clientId: number
  invoiceNumber: string
  amount: string
  invoiceDate: string
  periodStart: string
  periodEnd: string
  description?: string
  status?: InvoiceStatus
  dueDate?: string
  notes?: string
  serviceIds?: number[]
}

export interface UpdateInvoiceData extends Partial<CreateInvoiceData> { }

export interface CreateUserData {
  username: string
  password?: string
  fullName: string
  email: string
  role: UserRole
  position?: string
  avatarUrl?: string
  teamMemberId?: number
}

export interface UpdateUserData extends Partial<CreateUserData> {
  isActive?: boolean
}
