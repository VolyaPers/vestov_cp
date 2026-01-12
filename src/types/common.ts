// Common types shared across the application

export type UserRole = 'admin' | 'team_member' | 'client'
export type AccessLevel = 'read' | 'write' | 'admin'
export type ClientStatus = 'active' | 'inactive' | 'prospect'
export type ContractType = 'outstaffing' | 'outsourcing' | 'hybrid'
export type BillingCycle = 'monthly' | 'weekly' | 'hourly'
export type EmploymentType = 'fulltime' | 'part_time'
export type TeamMemberStatus = 'active' | 'bench' | 'unavailable'
export type LeaveRequestStatus = 'pending' | 'approved' | 'denied' | 'cancelled'
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
export type ShiftStatus = 'active' | 'on_break'

export interface User {
  id: number
  username: string
  fullName: string
  email: string
  role: UserRole
  position?: string
  avatarUrl?: string
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
}

export interface ClientService {
  id: number
  serviceTypeId: number
  serviceType?: {
    id: number
    name: string
    category: 'outstaffing' | 'outsourcing'
    billingModel: 'hourly' | 'monthly' | 'fixed'
  }
  rate?: number
  serviceLevelPrice?: number
  startDate: string
  endDate?: string
  isActive: boolean
}

export interface TeamMember {
  id: number
  name: string
  email: string
  position?: string
  skills: string[]
  hourlyRate: number
  experienceLevel: 'junior' | 'middle' | 'senior' | 'lead'
  status: TeamMemberStatus
  bio?: string
  location?: string
  clientId?: number
  createdAt?: string
  updatedAt?: string
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
  }
  startDate: string
  endDate: string
  reason?: string
  status: LeaveRequestStatus
  decisionReason?: string
  createdAt: string
  updatedAt: string
}

export interface LeaveType {
  id: number
  name: string
  maxDays?: number
  description?: string
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
  developerId: number
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
  position?: string
  skills: string[]
  hourlyRate: number
  experienceLevel: 'junior' | 'middle' | 'senior' | 'lead'
  status: TeamMemberStatus
  bio?: string
  location?: string
  clientId?: number
}

export interface UpdateTeamMemberData extends Partial<CreateTeamMemberData> {
  role?: string // Alias for position in team members
  startDate?: string
  phone?: string
  isBillable?: boolean
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

export interface UpdateInvoiceData extends Partial<CreateInvoiceData> {}

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

