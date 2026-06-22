import type {
  User,
  Client,
  TeamMember,
  AdminGlobalSearchResponse,
  LeaveRequest,
  CreateClientData,
  UpdateClientData,
  CreateTeamMemberData,
  UpdateTeamMemberData,
  CreateLeaveRequestData,
  UpdateLeaveRequestData,
  CreateInvoiceData,
  UpdateInvoiceData,
  CreateUserData,
  UpdateUserData,
  ClickUpIntegrationStatus,
  ClickUpComplianceResponse,
  ClickUpMember,
  ClickUpMemberMapping,
  ClickUpTimeEntry,
  ClickUpTimeReportRow,
} from '../types/common'

const envApiUrl = import.meta.env.VITE_API_URL
const normalizedEnvApiUrl = envApiUrl
  ? (envApiUrl.endsWith('/api') ? envApiUrl : `${envApiUrl.replace(/\/$/, '')}/api`)
  : '/api'

// Use same-origin API paths in the browser so auth/session cookies stay first-party.
const API_BASE = typeof window === 'undefined' ? normalizedEnvApiUrl : '/api'

const buildQueryString = (params: Record<string, string | number | undefined>) => {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value))
    }
  })

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

export const resolveApiAssetUrl = (assetUrl?: string | null) => {
  if (!assetUrl) {
    return undefined
  }

  if (/^(https?:)?\/\//i.test(assetUrl) || assetUrl.startsWith('data:') || assetUrl.startsWith('blob:')) {
    return assetUrl
  }

  const normalizedPath = assetUrl.startsWith('/') ? assetUrl : `/${assetUrl}`
  const apiAssetPath = normalizedPath.startsWith('/uploads/')
    ? `/api${normalizedPath}`
    : normalizedPath

  if (typeof window === 'undefined') {
    return apiAssetPath
  }

  try {
    const apiOrigin = new URL(API_BASE, window.location.origin).origin
    return `${apiOrigin}${apiAssetPath}`
  } catch {
    return apiAssetPath
  }
}

export type FinanceCategoryKind = 'income' | 'expense'

export interface FinanceCategory {
  id: number
  kind: FinanceCategoryKind
  name: string
  createdAt: string
  updatedAt: string
}

export interface FinanceCategoriesResponse {
  income: FinanceCategory[]
  expense: FinanceCategory[]
}

export interface FinanceAuditLog {
  id: number
  action: string
  entityType: string
  entityId: number
  teamMemberId: number | null
  clientId: number | null
  invoiceId: number | null
  transactionId: number | null
  summary: string
  beforeData: Record<string, any> | null
  afterData: Record<string, any> | null
  metadata: Record<string, any> | null
  createdAt: string
  actorName: string | null
  actorAvatarUrl: string | null
}

export interface SalaryHistoryEntry {
  id: string
  kind: 'log' | 'rate'
  title: string
  action: string
  entityType: string
  createdAt: string
  actorName: string | null
  actorAvatarUrl: string | null
  effectiveDate: string | null
  note: string | null
  beforeData: Record<string, any> | null
  afterData: Record<string, any> | null
  metadata: Record<string, any> | null
}

export interface SalaryHistoryResponse {
  member: {
    id: number
    name: string
    monthlyRate: string | number
    monthlySalaryExtras: Array<{ label: string; amount: number | string }>
  }
  history: SalaryHistoryEntry[]
}

export interface NavigationIndicators {
  pendingLeaveRequests: number
  openReimbursements: number
}

class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

class ApiClient {
  request = async (endpoint: string, options: RequestInit = {}) => {
    const url = `${API_BASE}${endpoint}`
    const config: RequestInit = {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    }

    let response: Response
    try {
      response = await fetch(url, config)
    } catch (error) {
      // Network error or CORS error - fetch fails before getting a response
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('[API REQUEST] Network/CORS error:', {
        url,
        error: errorMessage,
        API_BASE,
        envApiUrl: import.meta.env.VITE_API_URL,
        isCorsError: errorMessage.includes('CORS') || errorMessage.includes('Failed to fetch'),
      })

      // Provide more helpful error message
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        const helpfulMessage = !import.meta.env.VITE_API_URL
          ? 'Failed to connect to server. Please check if VITE_API_URL is configured in production.'
          : `Failed to connect to server at ${url}. This may be a CORS or network issue.`
        throw new Error(helpfulMessage)
      }
      throw error
    }

    // Handle 304 Not Modified (cached response)
    if (response.status === 304) {
      // Return empty object for 304 - caller should handle cached data
      return {}
    }

    // Read response body once - can only be read once
    const contentType = response.headers.get('content-type')
    const text = await response.text()

    if (!response.ok) {
      let errorMessage = `API Error: ${response.status}`
      try {
        if (text) {
          const errorData = JSON.parse(text)
          if (errorData.error) {
            errorMessage = errorData.error
          } else if (errorData.message) {
            errorMessage = errorData.message
          }
        }
      } catch {
        // Use default error message if parsing fails
        if (text) {
          errorMessage = text.slice(0, 200)
        }
      }
      console.error('[API REQUEST] Error response:', { url, status: response.status, errorMessage, text: text.slice(0, 200) })
      throw new ApiError(response.status, errorMessage)
    }

    // Check if response has content
    if (!text) {
      return {}
    }

    // Check content type and try to parse as JSON
    try {
      const parsed = JSON.parse(text)
      return parsed
    } catch (error) {
      console.error('[API REQUEST] Failed to parse JSON response:', {
        url,
        status: response.status,
        contentType,
        textLength: text.length,
        textPreview: text.slice(0, 500),
        error: error instanceof Error ? error.message : String(error)
      })
      throw new Error('Invalid JSON response from server')
    }
  }

  // Request with FormData (for file uploads)
  requestFormData = async (endpoint: string, formData: FormData) => {
    const url = `${API_BASE}${endpoint}`
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      body: formData
    })

    if (!response.ok) {
      let errorMessage = `API Error: ${response.status}`
      try {
        const text = await response.text()
        if (text) {
          const errorData = JSON.parse(text)
          if (errorData.error) {
            errorMessage = errorData.error
          }
        }
      } catch {
        // Use default error message if parsing fails
      }
      throw new Error(errorMessage)
    }

    const contentType = response.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      return response.json()
    }
    return response
  }

  // Request binary data (for file downloads)
  requestBinary = async (endpoint: string, options: RequestInit = {}) => {
    const url = `${API_BASE}${endpoint}`
    const config: RequestInit = {
      ...options,
      credentials: 'include',
      headers: {
        ...options.headers,
      },
    }

    const response = await fetch(url, config)

    if (!response.ok) {
      let errorMessage = `API Error: ${response.status}`
      try {
        const text = await response.text()
        if (text) {
          const errorData = JSON.parse(text)
          if (errorData.error) {
            errorMessage = errorData.error
          }
        }
      } catch {
        // Use default error message if parsing fails
      }
      throw new Error(errorMessage)
    }

    return response.blob()
  }

  // Auth
  login = async (username: string, password: string) => {
    return this.request('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
  }

  register = async (data: {
    firstName: string
    lastName: string
    email: string
    password: string
    role: 'admin' | 'client' | 'team_member'
  }) => {
    return this.request('/register', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  logout = async () => {
    return this.request('/logout', { method: 'POST' })
  }

  syncClerkSession = async (token: string): Promise<{ user: User }> => {
    return this.request('/auth/clerk/sync', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }) as Promise<{ user: User }>
  }

  getCurrentUser = async (): Promise<User | null> => {
    try {
      return await this.request('/user') as User
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        return null
      }

      const err = error instanceof Error ? error : new Error(String(error))
      if (err.message.toLowerCase().includes('not authenticated')) {
        return null
      }

      throw error
    }
  }

  // Clients
  async getClients(): Promise<Client[]> {
    return this.request('/services/clients') as Promise<Client[]>
  }

  async getClient(id: string): Promise<Client> {
    return this.request(`/services/clients/${id}`) as Promise<Client>
  }

  async createClient(data: CreateClientData): Promise<Client> {
    return this.request('/admin/clients', {
      method: 'POST',
      body: JSON.stringify(data),
    }) as Promise<Client>
  }

  async updateClient(id: string, data: UpdateClientData): Promise<Client> {
    return this.request(`/services/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }) as Promise<Client>
  }

  // Team Members
  async getTeamMembers(): Promise<TeamMember[]> {
    return this.request('/admin/team-members') as Promise<TeamMember[]>
  }

  async getAvailableTeamMemberUsers(): Promise<User[]> {
    return this.request('/users/available-team-member-users') as Promise<User[]>
  }

  async getTeamMember(id: string): Promise<TeamMember> {
    return this.request(`/admin/team-members/${id}`) as Promise<TeamMember>
  }

  async createTeamMember(data: CreateTeamMemberData | { userId: number }): Promise<TeamMember> {
    return this.request('/admin/team-members', {
      method: 'POST',
      body: JSON.stringify(data),
    }) as Promise<TeamMember>
  }

  async updateTeamMember(id: string, data: UpdateTeamMemberData): Promise<TeamMember> {
    return this.request(`/admin/team-members/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }) as Promise<TeamMember>
  }

  async deleteTeamMember(id: string) {
    return this.request(`/admin/team-members/${id}`, {
      method: 'DELETE',
    })
  }

  // Leave Requests
  getLeaveRequests = async (filters: {
    status?: string
    employeeId?: number
    startDate?: string
    endDate?: string
    clientId?: number
  } = {}): Promise<LeaveRequest[]> => {
    return this.request(`/vacation/requests${buildQueryString(filters)}`) as Promise<LeaveRequest[]>
  }

  createLeaveRequest = async (data: CreateLeaveRequestData): Promise<LeaveRequest> => {
    return this.request('/vacation/requests', {
      method: 'POST',
      body: JSON.stringify(data),
    }) as Promise<LeaveRequest>
  }

  updateLeaveRequest = async (id: string, data: UpdateLeaveRequestData): Promise<LeaveRequest> => {
    return this.request(`/vacation/requests/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }) as Promise<LeaveRequest>
  }

  approveLeaveRequest = async (id: string, reason?: string) => {
    return this.request(`/vacation/requests/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'approved', decisionReason: reason }),
    })
  }

  denyLeaveRequest = async (id: string, reason?: string) => {
    return this.request(`/vacation/requests/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'denied', decisionReason: reason }),
    })
  }

  cancelLeaveRequest = async (id: string, reason?: string) => {
    return this.request(`/vacation/requests/${id}/cancel`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    })
  }

  deleteLeaveRequest = async (id: string) => {
    return this.request(`/vacation/requests/${id}`, {
      method: 'DELETE',
    })
  }

  // Leave Balances
  getLeaveBalances = async () => {
    return this.request('/leave-balances')
  }

  getLeaveTypes = async () => {
    return this.request('/vacation/leave-types')
  }

  // Vacation/Leave Management
  getVacationEmployees = async (clientId?: number) => {
    return this.request(`/vacation/employees${buildQueryString({ clientId })}`)
  }

  getMyVacationBalance = async () => {
    return this.request('/vacation/my-balance')
  }

  getMySickLeaveBalance = async () => {
    return this.request('/vacation/my-sick-leave-balance')
  }

  getEmployeeVacationBalance = async (employeeId: number) => {
    return this.request(`/vacation/balance/${employeeId}`)
  }

  // Dashboard data
  async getAdminDashboard() {
    return this.request('/admin/dashboard')
  }

  async getAdminDashboardSummary() {
    return this.request('/admin/dashboard/summary')
  }

  async getAdminNavigationIndicators(): Promise<NavigationIndicators> {
    return this.request('/admin/navigation-indicators') as Promise<NavigationIndicators>
  }

  async getClientDashboard() {
    return this.request('/client/dashboard')
  }

  // Developers
  async getDevelopers() {
    return this.request('/services/developers')
  }

  async getServiceDevelopers(clientId: number, serviceId: number) {
    return this.request(`/services/clients/${clientId}/services/${serviceId}/developers`)
  }

  async getServiceDeveloperAssignments(params?: { clientId?: number; clientIds?: number[] }) {
    const searchParams = new URLSearchParams()
    if (params?.clientId) searchParams.append('clientId', params.clientId.toString())
    if (params?.clientIds?.length) searchParams.append('clientIds', params.clientIds.join(','))
    const query = searchParams.toString()
    return this.request(`/services/service-developer-assignments${query ? `?${query}` : ''}`) as Promise<Record<number, any[]>>
  }

  async addDeveloperToService(clientId: number, serviceId: number, data: {
    teamMemberId: number
    employmentType: 'fulltime' | 'part_time' | 'freelancer'
    hourlyRate?: number
    fixedPrice?: number
    startDate: string
  }) {
    return this.request(`/services/clients/${clientId}/services/${serviceId}/developers`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async removeDeveloperFromService(clientId: number, serviceId: number, assignmentId: number, permanent = false) {
    return this.request(`/services/clients/${clientId}/services/${serviceId}/developers/${assignmentId}?permanent=${permanent}`, {
      method: 'DELETE'
    })
  }

  async updateDeveloperPricing(clientId: number, serviceId: number, assignmentId: number, data: {
    hourlyRate?: number
    fixedPrice?: number
    workSchedule?: Record<string, string>
  }) {
    return this.request(`/services/clients/${clientId}/services/${serviceId}/developers/${assignmentId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    })
  }

  async updateClientService(clientId: number, serviceId: number, data: {
    rate?: number
    serviceLevelPrice?: number
    startDate?: string
    endDate?: string
    isActive?: boolean
    serviceTitle?: string | null
    slackChannelId?: string | null
  }) {
    return this.request(`/services/clients/${clientId}/services/${serviceId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  async updateServiceLevelPricing(clientId: number, serviceId: number, serviceLevelPrice?: number) {
    return this.request(`/services/clients/${clientId}/services/${serviceId}/pricing`, {
      method: 'PUT',
      body: JSON.stringify({ serviceLevelPrice })
    })
  }

  // Developer management
  async updateDeveloper(id: number, data: {
    name: string
    email: string
    skills: string[]
    hourlyRate: number
    experienceLevel: 'junior' | 'middle' | 'senior' | 'lead'
    status: 'available' | 'assigned' | 'unavailable'
    bio?: string
    location?: string
  }) {
    return this.request(`/services/developers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  async deleteDeveloper(id: number) {
    return this.request(`/services/developers/${id}`, {
      method: 'DELETE'
    })
  }

  // Invoice APIs
  async getAllInvoices(params?: { startDate?: string; endDate?: string }) {
    const searchParams = new URLSearchParams()
    if (params?.startDate) searchParams.append('startDate', params.startDate)
    if (params?.endDate) searchParams.append('endDate', params.endDate)

    const query = searchParams.toString()
    return this.request(`/invoices${query ? `?${query}` : ''}`)
  }

  async getClientInvoiceTotals(clientId: number) {
    return this.request(`/invoices/client/${clientId}/totals`)
  }

  async getClientInvoiceTotalsBatch(clientIds?: number[]) {
    const searchParams = new URLSearchParams()
    if (clientIds?.length) searchParams.append('clientIds', clientIds.join(','))
    const query = searchParams.toString()
    return this.request(`/invoices/totals${query ? `?${query}` : ''}`) as Promise<Array<{
      clientId: number
      totalInvoiced: number
      totalPaid: number
    }>>
  }

  async getClientInvoices(clientId: number) {
    return this.request(`/invoices/client/${clientId}`)
  }

  async getInvoice(invoiceId: number) {
    return this.request(`/invoices/${invoiceId}`)
  }

  async createInvoice(data: CreateInvoiceData) {
    return this.request('/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getClientServiceOptions(clientId: number) {
    return this.request(`/invoices/client-service-options/${clientId}`)
  }

  async calculateServicePricing(clientId: number, data: {
    serviceIds: number[]
    periodStart: string
    periodEnd: string
    developerRates?: { [key: number]: { hourlyRate?: number; fixedPrice?: number; hoursWorked?: number } }
    servicePrices?: { [key: number]: number }
  }) {
    return this.request(`/invoices/calculate-pricing/${clientId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async addServiceToClient(clientId: number, data: {
    serviceTypeId: number;
    rate?: number;
    serviceTitle?: string;
    startDate: string
  }) {
    return this.request(`/services/clients/${clientId}/services`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateInvoice(invoiceId: number, data: UpdateInvoiceData) {
    return this.request(`/invoices/${invoiceId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteInvoice(invoiceId: number) {
    return this.request(`/invoices/${invoiceId}`, {
      method: 'DELETE',
    })
  }

  // Finances
  async getFinancesOverview(params?: { startDate?: string; endDate?: string }) {
    const sp = new URLSearchParams()
    if (params?.startDate) sp.append('startDate', params.startDate)
    if (params?.endDate) sp.append('endDate', params.endDate)
    const q = sp.toString()
    return this.request(`/finances/overview${q ? `?${q}` : ''}`)
  }

  async getFinancialTransactions(params?: { type?: string; startDate?: string; endDate?: string; teamMemberId?: number; category?: string }) {
    const sp = new URLSearchParams()
    if (params?.type) sp.append('type', params.type)
    if (params?.startDate) sp.append('startDate', params.startDate)
    if (params?.endDate) sp.append('endDate', params.endDate)
    if (params?.teamMemberId) sp.append('teamMemberId', params.teamMemberId.toString())
    if (params?.category) sp.append('category', params.category)
    const q = sp.toString()
    return this.request(`/finances/transactions${q ? `?${q}` : ''}`)
  }

  async createFinancialTransaction(data: { type: string; amount: number; transactionDate: string; category?: string; description?: string; teamMemberId?: number; clientId?: number; invoiceId?: number; isRecurring?: boolean }) {
    return this.request('/finances/transactions', { method: 'POST', body: JSON.stringify(data) })
  }

  async updateFinancialTransaction(id: number, data: Record<string, any>) {
    return this.request(`/finances/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  }

  async deleteFinancialTransaction(id: number) {
    return this.request(`/finances/transactions/${id}`, { method: 'DELETE' })
  }

  async getClientPayments(params?: { startDate?: string; endDate?: string }) {
    const sp = new URLSearchParams()
    if (params?.startDate) sp.append('startDate', params.startDate)
    if (params?.endDate) sp.append('endDate', params.endDate)
    const q = sp.toString()
    return this.request(`/finances/client-payments${q ? `?${q}` : ''}`)
  }

  async getFinancesSalaries(year?: number) {
    return this.request(`/finances/salaries${year ? `?year=${year}` : ''}`)
  }

  async getFinanceLogs(params?: { teamMemberId?: number; entityType?: string; action?: string; entityId?: number; startDate?: string; endDate?: string; q?: string; limit?: number }): Promise<FinanceAuditLog[]> {
    const sp = new URLSearchParams()
    if (params?.teamMemberId) sp.append('teamMemberId', params.teamMemberId.toString())
    if (params?.entityType) sp.append('entityType', params.entityType)
    if (params?.action) sp.append('action', params.action)
    if (params?.entityId) sp.append('entityId', params.entityId.toString())
    if (params?.startDate) sp.append('startDate', params.startDate)
    if (params?.endDate) sp.append('endDate', params.endDate)
    if (params?.q) sp.append('q', params.q)
    if (params?.limit) sp.append('limit', params.limit.toString())
    const q = sp.toString()
    return this.request(`/finances/logs${q ? `?${q}` : ''}`) as Promise<FinanceAuditLog[]>
  }

  async recordSalaryPayment(data: {
    teamMemberId: number
    amount: number
    transactionDate: string
    description?: string
    salaryMonth?: string
    baseSalary?: number
    salaryPaidNow?: number
    remainingSalary?: number
    extras?: Array<{ label: string; amount: string | number }>
    note?: string
  }): Promise<{
    id: number
    email?: {
      delivered: boolean
      skipped?: boolean
      provider?: string
      error?: string
    }
  }> {
    return this.request('/finances/salaries/record', { method: 'POST', body: JSON.stringify(data) }) as Promise<{
      id: number
      email?: {
        delivered: boolean
        skipped?: boolean
        provider?: string
        error?: string
      }
    }>
  }

  async updateSalaryRate(teamMemberId: number, data: { monthlyRate: number; effectiveDate?: string; note?: string }) {
    return this.request(`/finances/salaries/${teamMemberId}/rate`, { method: 'PUT', body: JSON.stringify(data) })
  }

  async updateSalaryMonthlyExtras(teamMemberId: number, data: { monthlyExtras: Array<{ label: string; amount: string | number }> }) {
    return this.request(`/finances/salaries/${teamMemberId}/monthly-extras`, { method: 'PUT', body: JSON.stringify(data) })
  }

  async getSalaryRateHistory(teamMemberId: number) {
    return this.request(`/finances/salaries/${teamMemberId}/rate-history`)
  }

  async getSalaryHistory(teamMemberId: number): Promise<SalaryHistoryResponse> {
    return this.request(`/finances/salaries/${teamMemberId}/history`) as Promise<SalaryHistoryResponse>
  }

  async getFinanceCategories(kind?: FinanceCategoryKind): Promise<FinanceCategoriesResponse | FinanceCategory[]> {
    const sp = new URLSearchParams()
    if (kind) sp.append('kind', kind)
    const q = sp.toString()
    return this.request(`/finances/categories${q ? `?${q}` : ''}`)
  }

  async createFinanceCategory(data: { kind: FinanceCategoryKind; name: string }): Promise<FinanceCategory> {
    return this.request('/finances/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateFinanceCategory(id: number, data: { kind?: FinanceCategoryKind; name?: string }): Promise<FinanceCategory> {
    return this.request(`/finances/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteFinanceCategory(id: number): Promise<{ message: string }> {
    return this.request(`/finances/categories/${id}`, {
      method: 'DELETE',
    })
  }

  async getFinancesBalances(): Promise<{
    stripe: { available: number; pending: number; currency: string } | null
    payoneer: { available: number; currency: string } | null
    fetchedAt: string
  }> {
    return this.request('/finances/balances')
  }

  // Integration Settings
  async getIntegrations() {
    return this.request('/settings/integrations')
  }

  async getIntegration(provider: string) {
    return this.request(`/settings/integrations/${provider}`)
  }

  async saveIntegration(provider: string, credentials: Record<string, string>) {
    return this.request(`/settings/integrations/${provider}`, {
      method: 'PUT',
      body: JSON.stringify({ credentials }),
    })
  }

  async deleteIntegration(provider: string) {
    return this.request(`/settings/integrations/${provider}`, {
      method: 'DELETE',
    })
  }

  async getClickUpStatus(): Promise<ClickUpIntegrationStatus> {
    return this.request('/clickup/status')
  }

  async getClickUpCompliance(params?: {
    rangePreset?: 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_week' | 'last_month' | 'last_quarter' | 'last_year' | 'custom'
    startDate?: string
    endDate?: string
  }): Promise<ClickUpComplianceResponse> {
    return this.request(`/clickup/compliance${buildQueryString(params ?? {})}`)
  }

  async getClickUpMembers(): Promise<ClickUpMember[]> {
    return this.request('/clickup/members')
  }

  async validateClickUpToken(apiToken: string): Promise<{ workspaces: Array<{ id: string; name: string; color?: string | null }> }> {
    return this.request('/clickup/validate', {
      method: 'POST',
      body: JSON.stringify({ apiToken }),
    })
  }

  async getClickUpMemberMappings(): Promise<ClickUpMemberMapping[]> {
    return this.request('/clickup/member-mappings')
  }

  async saveClickUpMemberMappings(mappings: Array<{
    teamMemberId: number
    clickupUserId: string
    clickupUserName: string
    clickupUserEmail?: string | null
  }>): Promise<ClickUpMemberMapping[]> {
    return this.request('/clickup/member-mappings', {
      method: 'PUT',
      body: JSON.stringify({ mappings }),
    })
  }

  async syncClickUp(): Promise<{ success: boolean; runId: number; fetched: number; upserted: number; skipped: number }> {
    return this.request('/clickup/sync', {
      method: 'POST',
    })
  }

  async getClickUpTimeReport(params?: {
    startDate?: string
    endDate?: string
    teamMemberId?: number
    clientId?: number
    clientServiceId?: number
    attributionStatus?: 'assigned' | 'unassigned'
  }): Promise<{
    summary: {
      totalDurationMs: number
      totalHours: number
      totalEntries: number
      mappedMembers: number
    }
    rows: ClickUpTimeReportRow[]
  }> {
    return this.request(`/clickup/time-report${buildQueryString(params ?? {})}`)
  }

  async getClickUpTimeEntries(params?: {
    startDate?: string
    endDate?: string
    teamMemberId?: number
    clientId?: number
    clientServiceId?: number
    attributionStatus?: 'assigned' | 'unassigned'
    page?: number
    pageSize?: number
  }): Promise<{
    entries: ClickUpTimeEntry[]
    pagination: {
      page: number
      pageSize: number
      total: number
      totalPages: number
    }
  }> {
    return this.request(`/clickup/time-entries${buildQueryString(params ?? {})}`)
  }

  // User Management
  async getUsers(params?: { page?: number; limit?: number; role?: string; search?: string; clientId?: number }) {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.append('page', params.page.toString())
    if (params?.limit) searchParams.append('limit', params.limit.toString())
    if (params?.role) searchParams.append('role', params.role)
    if (params?.search) searchParams.append('search', params.search)
    if (params?.clientId) searchParams.append('clientId', params.clientId.toString())

    const query = searchParams.toString()
    return this.request(`/users${query ? `?${query}` : ''}`)
  }

  async getUser(id: number) {
    return this.request(`/users/${id}`)
  }

  async searchAdminGlobal(query: string, limit = 5): Promise<AdminGlobalSearchResponse> {
    const searchParams = new URLSearchParams()
    searchParams.append('q', query)
    searchParams.append('limit', limit.toString())

    return this.request(`/search/admin?${searchParams.toString()}`) as Promise<AdminGlobalSearchResponse>
  }

  async createUser(data: CreateUserData): Promise<User> {
    const response = await this.request('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }) as { user?: User } | User

    // Backend returns { user: ... }, extract it
    if (response && typeof response === 'object' && 'user' in response) {
      return response.user as User
    }
    return response as User
  }

  async updateUser(id: number, data: UpdateUserData): Promise<User> {
    return this.request(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }) as Promise<User>
  }

  async updateUserPassword(id: number, data: { currentPassword: string; newPassword: string }) {
    return this.request(`/users/${id}/password`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async getSlackAvatar(userId: number): Promise<{
    avatarUrl?: string
    avatar72?: string
    avatar192?: string
    avatar512?: string
    slackUserId?: string
  }> {
    return this.request(`/users/${userId}/slack-avatar`)
  }

  async syncSlackAvatar(userId: number): Promise<{
    success: boolean
    avatarUrl: string
    message: string
  }> {
    return this.request(`/users/${userId}/sync-slack-avatar`, {
      method: 'POST',
    })
  }

  async syncAllSlackAvatars(): Promise<{
    success: boolean
    message: string
    results: {
      total: number
      synced: number
      notFound: number
      errors: number
    }
  }> {
    return this.request('/users/sync-all-slack-avatars', {
      method: 'POST',
    })
  }

  async assignUserToClient(userId: number, clientId: number, data: {
    accessLevel?: 'read' | 'write' | 'admin'
    assignedBy: number
  }) {
    return this.request(`/users/${userId}/clients/${clientId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateClientAssignment(userId: number, clientId: number, data: {
    accessLevel?: 'read' | 'write' | 'admin'
    isActive?: boolean
  }) {
    return this.request(`/users/${userId}/clients/${clientId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async removeUserFromClient(userId: number, clientId: number) {
    return this.request(`/users/${userId}/clients/${clientId}`, {
      method: 'DELETE',
    })
  }

  async getClientUsers(clientId: number) {
    return this.request(`/users/clients/${clientId}/users`)
  }

  async deactivateUser(id: number) {
    return this.request(`/users/${id}`, {
      method: 'DELETE',
    })
  }

  async deleteUserHard(id: number) {
    return this.request(`/users/${id}/hard`, {
      method: 'DELETE',
    })
  }

  // Logo upload
  async uploadClientLogo(clientId: number, file: File) {
    const formData = new FormData()
    formData.append('logo', file)
    return this.requestFormData(`/admin/clients/${clientId}/logo`, formData)
  }

  async uploadClientContactAvatar(contactId: number, file: File) {
    const formData = new FormData()
    formData.append('avatar', file)
    return this.requestFormData(`/client-contacts/${contactId}/avatar`, formData)
  }

  // Shift Management
  async getMyServices() {
    return this.request('/shifts/my-services') as Promise<{
      services: Array<{
        serviceId: number
        serviceName: string
        clientName: string
        employmentType: 'fulltime' | 'part_time' | 'freelancer'
        workSchedule: Record<string, string>
        serviceTitle: string | null
        slackChannelId: string | null
      }>
    }>
  }

  async getCurrentShift() {
    return this.request('/shifts/current')
  }

  async startShift(serviceId?: number, comment?: string) {
    return this.request('/shifts/start', {
      method: 'POST',
      body: JSON.stringify({ serviceId, comment: comment || undefined }),
    })
  }

  async endShift() {
    return this.request('/shifts/end', {
      method: 'POST',
    })
  }

  async startBreak(data?: { description?: string }) {
    return this.request('/shifts/break/start', {
      method: 'POST',
      body: JSON.stringify(data || {}),
    })
  }

  async endBreak() {
    return this.request('/shifts/break/end', {
      method: 'POST',
    })
  }

  async getActiveShifts() {
    return this.request('/shifts/active')
  }

  async getLateShifts() {
    return this.request('/shifts/late')
  }

  async getMissedShifts() {
    return this.request('/shifts/missed')
  }

  async getEmployeeShifts(employeeId: number, params?: { startDate?: string; endDate?: string }) {
    const searchParams = new URLSearchParams()
    if (params?.startDate) searchParams.append('startDate', params.startDate)
    if (params?.endDate) searchParams.append('endDate', params.endDate)
    const query = searchParams.toString()
    return this.request(`/shifts/employee/${employeeId}${query ? `?${query}` : ''}`)
  }

  async getAdminActiveShifts() {
    return this.request('/shifts/admin/active')
  }

  async getAdminLateShifts() {
    return this.request('/shifts/admin/late')
  }

  async getClientTeamShifts() {
    return this.request('/shifts/client/team')
  }

  async getClientTeamVacations() {
    return this.request('/vacation/client/team')
  }

  async getClientTeamSchedules() {
    return this.request('/vacation/client/team/schedules')
  }

  // Preferred Shifts Methods
  async getMyPreferredShifts() {
    return this.request('/shifts/preferred/me')
  }

  async updateMyPreferredShifts(schedules: Array<{ dayOfWeek: number; startTime: string; endTime: string; isActive: boolean }>) {
    return this.request('/shifts/preferred/me', {
      method: 'PUT',
      body: JSON.stringify({ schedules }),
    })
  }

  async getEmployeePreferredShifts(employeeId: number) {
    return this.request(`/shifts/preferred/${employeeId}`)
  }

  async updateEmployeePreferredShifts(employeeId: number, schedules: Array<{ dayOfWeek: number; startTime: string; endTime: string; isActive: boolean }>) {
    return this.request(`/shifts/preferred/${employeeId}`, {
      method: 'PUT',
      body: JSON.stringify({ schedules }),
    })
  }

  async getAllPreferredShifts() {
    return this.request('/shifts/preferred')
  }

  // Shift Override Methods
  async getMyShiftOverrides(month: string) {
    return this.request(`/shifts/overrides/me?month=${month}`)
  }

  async updateMyShiftOverride(date: string, data: { startTime: string; endTime: string; isDayOff: boolean }) {
    return this.request(`/shifts/overrides/me/${date}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteMyShiftOverride(date: string) {
    return this.request(`/shifts/overrides/me/${date}`, {
      method: 'DELETE',
    })
  }

  async getAllShiftOverrides(month: string) {
    return this.request(`/shifts/overrides/all?month=${month}`)
  }

  // Document Management Methods
  async getClientsWithServices() {
    return this.request('/documents/clients-with-services')
  }

  async getServiceDocuments(clientServiceId: number) {
    return this.request(`/documents/service/${clientServiceId}`)
  }

  async getServiceDocumentsClientVisible(clientServiceId: number) {
    return this.request(`/documents/service/${clientServiceId}/client-visible`)
  }

  async createDocumentFolder(data: { clientServiceId: number; name: string; parentFolderId?: number }) {
    return this.request('/documents/folder', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async renameDocumentFolder(folderId: number, name: string) {
    return this.request(`/documents/folder/${folderId}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    })
  }

  async deleteDocumentFolder(folderId: number, deleteContents: boolean = false) {
    return this.request(`/documents/folder/${folderId}?deleteContents=${deleteContents}`, {
      method: 'DELETE',
    })
  }

  async updateDocumentVisibility(documentId: number, visibleToClient: boolean) {
    return this.request(`/documents/${documentId}/visibility`, {
      method: 'PATCH',
      body: JSON.stringify({ visibleToClient }),
    })
  }

  async uploadServiceDocument(formData: FormData) {
    return this.requestFormData('/documents/upload', formData)
  }

  // Feedback Methods
  async getAdminFeedbacks() {
    return this.request('/feedback/admin')
  }

  async getClientFeedbacks() {
    return this.request('/feedback/client')
  }

  async getFeedbackClientServices() {
    return this.request('/feedback/client-services')
  }

  async getFeedbackServiceDevelopers(clientServiceId: number) {
    return this.request(`/feedback/service/${clientServiceId}/developers`)
  }

  async submitFeedback(data: {
    clientServiceId?: number
    teamMemberId?: number
    rating: number
    comments: string
    feedbackType: string
  }) {
    return this.request('/feedback', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async respondToFeedback(feedbackId: number, adminResponse: string) {
    return this.request(`/feedback/${feedbackId}/respond`, {
      method: 'POST',
      body: JSON.stringify({ adminResponse }),
    })
  }

  async deleteFeedback(feedbackId: number) {
    return this.request(`/feedback/${feedbackId}`, {
      method: 'DELETE',
    })
  }
}

export const api = new ApiClient()
