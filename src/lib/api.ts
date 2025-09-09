const API_BASE = '/api'

class ApiClient {
  private request = async (endpoint: string, options: RequestInit = {}) => {
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
      } catch (e) {
        // If we can't parse the error response, use the default message
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

  logout = async () => {
    return this.request('/logout', { method: 'POST' })
  }

  getCurrentUser = async () => {
    try {
      const result = await this.request('/user')
      return result
    } catch (error: any) {
      if (error.message.includes('401')) {
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
    return this.request('/services/clients', {
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
    return this.request('/team-members')
  }

  async getTeamMember(id: string) {
    return this.request(`/team-members/${id}`)
  }

  async createTeamMember(data: any) {
    return this.request('/team-members', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateTeamMember(id: string, data: any) {
    return this.request(`/team-members/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  // Leave Requests
  async getLeaveRequests() {
    return this.request('/leave-requests')
  }

  async createLeaveRequest(data: any) {
    return this.request('/leave-requests', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateLeaveRequest(id: string, data: any) {
    return this.request(`/leave-requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async approveLeaveRequest(id: string, reason?: string) {
    return this.request(`/leave-requests/${id}/approve`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    })
  }

  async denyLeaveRequest(id: string, reason?: string) {
    return this.request(`/leave-requests/${id}/deny`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    })
  }

  async cancelLeaveRequest(id: string, reason?: string) {
    return this.request(`/leave-requests/${id}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    })
  }

  // Leave Balances
  async getLeaveBalances() {
    return this.request('/leave-balances')
  }

  async getLeaveTypes() {
    return this.request('/leave-types')
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
    return this.request(`/services/clients/${clientId}/options`)
  }

  async calculateServicePricing(clientId: number, data: {
    serviceIds: number[]
    periodStart: string
    periodEnd: string
    developerRates?: { [key: number]: { hourlyRate?: number; fixedPrice?: number; hoursWorked?: number } }
  }) {
    return this.request(`/services/clients/${clientId}/calculate-pricing`, {
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
}

export const api = new ApiClient()