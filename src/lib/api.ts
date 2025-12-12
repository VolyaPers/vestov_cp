const envApiUrl = import.meta.env.VITE_API_URL
const API_BASE = envApiUrl 
  ? (envApiUrl.endsWith('/api') ? envApiUrl : `${envApiUrl.replace(/\/$/, '')}/api`)
  : '/api'

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

    const response = await fetch(url, config)
    
    if (!response.ok) {
      let errorMessage = `API Error: ${response.status}`
      try {
        const errorData = await response.json()
        if (errorData.error) {
          errorMessage = errorData.error
        }
      } catch {
        // Use default error message if parsing fails
      }
      throw new Error(errorMessage)
    }

    return response.json()
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

  getCurrentUser = async () => {
    try {
      return await this.request('/user')
    } catch (error) {
      const err = error as Error
      if (err.message.includes('401')) {
        return null
      }
      throw error
    }
  }

  // Clients
  async getClients() {
    return this.request('/services/clients')
  }

  async getClient(id: string) {
    return this.request(`/services/clients/${id}`)
  }

  async createClient(data: any) {
    return this.request('/admin/clients', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateClient(id: string, data: any) {
    return this.request(`/services/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  // Team Members
  async getTeamMembers() {
    return this.request('/admin/team-members')
  }

  async getTeamMember(id: string) {
    return this.request(`/admin/team-members/${id}`)
  }

  async createTeamMember(data: any) {
    return this.request('/admin/team-members', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateTeamMember(id: string, data: any) {
    return this.request(`/admin/team-members/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteTeamMember(id: string) {
    return this.request(`/admin/team-members/${id}`, {
      method: 'DELETE',
    })
  }

  // Leave Requests
  getLeaveRequests = async () => {
    return this.request('/vacation/requests')
  }

  createLeaveRequest = async (data: any) => {
    return this.request('/vacation/requests', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  updateLeaveRequest = async (id: string, data: any) => {
    return this.request(`/vacation/requests/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
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
  getVacationEmployees = async () => {
    return this.request('/vacation/employees')
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

  async addDeveloperToService(clientId: number, serviceId: number, data: {
    developerId: number
    employmentType: 'fulltime' | 'part_time'
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
  async createDeveloper(data: {
    name: string
    email: string
    skills: string[]
    hourlyRate: number
    experienceLevel: 'junior' | 'middle' | 'senior' | 'lead'
    status: 'available' | 'assigned' | 'unavailable'
    bio?: string
    location?: string
  }) {
    return this.request('/services/developers', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

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

  async getClientInvoices(clientId: number) {
    return this.request(`/invoices/client/${clientId}`)
  }

  async createInvoice(data: any) {
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
  }) {
    return this.request(`/invoices/calculate-pricing/${clientId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async addServiceToClient(clientId: number, data: { 
    serviceTypeId: number; 
    rate?: number; 
    startDate: string 
  }) {
    return this.request(`/services/clients/${clientId}/services`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateInvoice(invoiceId: number, data: any) {
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

  async getAvailableTeamMembers() {
    return this.request('/users/available-team-members')
  }

  async createUser(data: {
    username: string
    password: string
    fullName: string
    email: string
    role: 'admin' | 'team_member' | 'client'
    position?: string
    avatarUrl?: string
    teamMemberId?: number
  }) {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateUser(id: number, data: {
    username?: string
    fullName?: string
    email?: string
    role?: 'admin' | 'team_member' | 'client'
    position?: string
    avatarUrl?: string
    isActive?: boolean
  }) {
    return this.request(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async updateUserPassword(id: number, data: { currentPassword: string; newPassword: string }) {
    return this.request(`/users/${id}/password`, {
      method: 'PUT',
      body: JSON.stringify(data),
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

  // Logo upload
  async uploadClientLogo(clientId: number, file: File) {
    const formData = new FormData()
    formData.append('logo', file)

    const url = `${API_BASE}/admin/clients/${clientId}/logo`
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      body: formData
    })

    if (!response.ok) {
      let errorMessage = `Upload failed: ${response.status}`
      try {
        const errorData = await response.json()
        if (errorData.error) {
          errorMessage = errorData.error
        }
      } catch {
        // Use default error message
      }
      throw new Error(errorMessage)
    }

    return response.json()
  }

  // Shift Management
  async getCurrentShift() {
    return this.request('/shifts/current')
  }

  async startShift() {
    return this.request('/shifts/start', {
      method: 'POST',
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
}

export const api = new ApiClient()