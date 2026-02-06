/// <reference types="cypress" />

// Type definitions for user creation
interface CreateUserData {
  username: string
  password: string
  fullName: string
  email: string
  role: 'admin' | 'team_member' | 'client'
}

// Type definitions for invoice form
interface InvoiceFormData {
  serviceIds?: number[]
  periodStart: string
  periodEnd: string
  notes?: string
}

// Type definitions for leave request
interface LeaveRequestData {
  employeeId?: string
  leaveTypeId: string
  startDate: string
  endDate: string
  reason?: string
  autoApprove?: boolean
}

// Type definitions for reimbursement
interface ReimbursementData {
  expenseAmount: string
  description: string
  category?: string
}

// Type definitions for client
interface CreateClientData {
  name: string
  industry?: string
  status?: string
  contractType?: string
}

// Type definitions for feedback
interface FeedbackData {
  rating: number
  comments: string
  serviceId?: string
  developerId?: string
}

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Login as admin user
       */
      loginAsAdmin(): Chainable<void>

      /**
       * Login as team member user
       */
      loginAsTeamMember(): Chainable<void>

      /**
       * Login as client user
       */
      loginAsClient(): Chainable<void>

      /**
       * Generic login with username and password
       */
      login(username: string, password: string): Chainable<void>

      /**
       * Logout current user
       */
      logout(): Chainable<void>

      /**
       * Register a new user via the registration form
       */
      registerUser(userData: CreateUserData): Chainable<void>

      /**
       * Wait for API request to complete
       */
      waitForApiRequest(alias: string): Chainable<void>

      /**
       * Get client details page
       */
      visitClientDetails(clientId: number): Chainable<void>

      /**
       * Open create invoice dialog
       */
      openCreateInvoiceDialog(): Chainable<void>

      /**
       * Select service in invoice form
       */
      selectService(serviceName: string): Chainable<void>

      /**
       * Switch developer pricing mode
       */
      switchDeveloperMode(developerName: string, mode: 'hourly' | 'fixed'): Chainable<void>

      /**
       * Remove developer from service
       */
      removeDeveloper(developerName: string): Chainable<void>

      /**
       * Get calculated total value
       */
      getCalculatedTotal(): Chainable<string>

      // ===== NEW INVOICE COMMANDS =====
      /**
       * Navigate to client details and prepare for invoice creation
       */
      createInvoiceForClient(clientId: number): Chainable<void>

      /**
       * Fill invoice form with data
       */
      fillInvoiceForm(data: InvoiceFormData): Chainable<void>

      /**
       * Toggle service checkbox in invoice form
       */
      toggleServiceInInvoice(serviceName: string): Chainable<void>

      // ===== VACATION/LEAVE COMMANDS =====
      /**
       * Create a leave request as admin (with optional auto-approve)
       */
      createLeaveRequestAdmin(data: LeaveRequestData): Chainable<void>

      /**
       * Approve a pending leave request
       */
      approveLeaveRequest(requestId: string): Chainable<void>

      /**
       * Deny a pending leave request with reason
       */
      denyLeaveRequest(requestId: string, reason: string): Chainable<void>

      /**
       * Submit employee leave request
       */
      submitLeaveRequest(data: LeaveRequestData): Chainable<void>

      // ===== REIMBURSEMENT COMMANDS =====
      /**
       * Submit a reimbursement request
       */
      submitReimbursement(data: ReimbursementData): Chainable<void>

      /**
       * Approve reimbursement with optional note
       */
      approveReimbursement(requestId: number, note?: string): Chainable<void>

      /**
       * Reject reimbursement with required reason
       */
      rejectReimbursement(requestId: number, reason: string): Chainable<void>

      /**
       * Upload evidence for approved reimbursement
       */
      uploadReimbursementEvidence(requestId: number, fileName: string): Chainable<void>

      // ===== CLIENT MANAGEMENT COMMANDS =====
      /**
       * Create a new client
       */
      createClient(data: CreateClientData): Chainable<void>

      /**
       * Add service to client
       */
      addServiceToClient(clientId: number, serviceTypeId: number): Chainable<void>

      // ===== FEEDBACK COMMANDS =====
      /**
       * Submit client feedback with rating
       */
      submitFeedback(data: FeedbackData): Chainable<void>

      /**
       * Respond to feedback as admin
       */
      respondToFeedback(feedbackId: number, response: string): Chainable<void>

      // ===== UTILITY COMMANDS =====
      /**
       * Wait for loading spinner to disappear
       */
      waitForLoading(): Chainable<void>

      /**
       * Assert toast/alert message appears
       */
      assertAlert(message: string, type?: 'success' | 'error' | 'warning'): Chainable<void>

      /**
       * Select value from custom Select component (Radix UI)
       */
      selectDropdownValue(triggerSelector: string, value: string): Chainable<void>

      /**
       * Set date input value
       */
      setDateInput(selector: string, date: string): Chainable<void>
    }
  }
}

// Generic login command
Cypress.Commands.add('login', (username: string, password: string) => {
  cy.visit('/')
  cy.get('input[id="username"]').type(username)
  cy.get('input[id="password"]').type(password)
  cy.get('button[type="submit"]').click()
  cy.url().should('not.include', '/login')
  cy.get('body', { timeout: 10000 }).should('contain.text', 'Dashboard')
})

// Login as admin
Cypress.Commands.add('loginAsAdmin', () => {
  cy.visit('/')
  cy.get('input[id="username"]').type('admin')
  cy.get('input[id="password"]').type('admin123')
  cy.get('button[type="submit"]').click()
  cy.url({ timeout: 10000 }).should('include', '/admin')
})

// Login as team member
Cypress.Commands.add('loginAsTeamMember', () => {
  cy.visit('/')
  cy.get('input[id="username"]').type('eduardo')
  cy.get('input[id="password"]').type('eduardo123')
  cy.get('button[type="submit"]').click()
  cy.url({ timeout: 10000 }).should('include', '/employee')
})

// Login as client
Cypress.Commands.add('loginAsClient', () => {
  // Claim/register a client account with a known password via the register endpoint
  cy.request({
    method: 'POST',
    url: 'http://localhost:3001/api/register',
    body: {
      firstName: 'Kamran',
      lastName: 'Client',
      email: 'john.smith@techcorp.com',
      password: 'client123',
      role: 'client'
    },
    failOnStatusCode: false
  }).then(() => {
    // After register (which may auto-login), try API login with email
    cy.request({
      method: 'POST',
      url: 'http://localhost:3001/api/login',
      body: { username: 'john.smith@techcorp.com', password: 'client123' },
      failOnStatusCode: false
    }).then((loginResponse) => {
      if (loginResponse.status !== 200) {
        // Fallback: try with username 'kamran'
        cy.request({
          method: 'POST',
          url: 'http://localhost:3001/api/login',
          body: { username: 'kamran', password: 'client123' },
          failOnStatusCode: false
        })
      }
    })
  })

  cy.visit('/client/dashboard')
  cy.url({ timeout: 10000 }).should('include', '/client')
})

// Logout current user
Cypress.Commands.add('logout', () => {
  // Find the logout button - it contains a LogOut icon from lucide-react
  // The icon will have class "lucide-log-out" or similar
  cy.get('button:has(svg.lucide-log-out)').first().click({ force: true })
  // Should redirect to login page
  cy.url({ timeout: 10000 }).should('eq', Cypress.config().baseUrl + '/')
})

// Register a new user via the registration form
Cypress.Commands.add('registerUser', (userData: CreateUserData) => {
  cy.visit('/')
  // Click on "Create Account" tab to switch to registration mode
  cy.contains('button', 'Create Account').click()

  // Fill registration form
  const nameParts = userData.fullName.split(' ')
  cy.get('input[id="firstName"]').type(nameParts[0])
  cy.get('input[id="lastName"]').type(nameParts.slice(1).join(' ') || 'Test')
  cy.get('input[id="email"]').type(userData.email)
  cy.get('input[id="new-password"]').type(userData.password)

  // Select role from dropdown
  cy.get('select[id="role"]').select(userData.role)

  // Submit form - button text changes to "Create Account" when in register mode
  cy.get('button[type="submit"]').click()

  // Wait for registration to complete - should redirect based on role
  cy.url({ timeout: 15000 }).should('include', '/dashboard')
})

// Wait for API request
Cypress.Commands.add('waitForApiRequest', (alias: string) => {
  cy.wait(alias).then((interception) => {
    expect(interception.response?.statusCode).to.be.oneOf([200, 201, 304])
  })
})

// Visit client details page
Cypress.Commands.add('visitClientDetails', (clientId: number) => {
  cy.visit(`/admin/clients/${clientId}`)
  // Wait for client page to load - check for any client content
  cy.url().should('include', `/admin/clients/${clientId}`)
  cy.get('body').should('satisfy', ($body) => {
    const text = $body.text().toLowerCase()
    return text.includes('client') || text.includes('invoice') || text.includes('service')
  })
})

// Open create invoice dialog
Cypress.Commands.add('openCreateInvoiceDialog', () => {
  cy.contains('button', 'Create Invoice').click()
  // Wait for dialog to open - check for any "Create Invoice" dialog content
  cy.get('body').should('satisfy', ($body) => {
    const text = $body.text().toLowerCase()
    return text.includes('create invoice') || text.includes('active services')
  })
})

// Select service in invoice form
Cypress.Commands.add('selectService', (serviceName: string) => {
  // Find the service by name, then find the checkbox in the same card and click it
  cy.contains('.space-y-3', serviceName).within(() => {
    cy.get('[role="checkbox"]').click({ force: true })
  })
})

// Switch developer pricing mode
Cypress.Commands.add('switchDeveloperMode', (developerName: string, mode: 'hourly' | 'fixed') => {
  cy.contains('.p-3', developerName).within(() => {
    cy.contains('button', mode === 'hourly' ? 'Hourly' : 'Fixed').click()
  })
})

// Remove developer from service
Cypress.Commands.add('removeDeveloper', (developerName: string) => {
  cy.contains('.p-3', developerName).within(() => {
    cy.get('button').contains('×').click()
  })
})

// Get calculated total value
Cypress.Commands.add('getCalculatedTotal', () => {
  return cy.get('.bg-green-50').should('be.visible').invoke('text').then((text) => {
    // Extract just the numeric part with commas, removing $ and other text
    const match = text.match(/\$([0-9,]+)/)
    return match ? match[1] : '0'
  })
})

// ===== NEW INVOICE COMMANDS =====

// Navigate to client details and prepare for invoice creation
Cypress.Commands.add('createInvoiceForClient', (clientId: number) => {
  cy.visit(`/admin/clients/${clientId}`)
  cy.url().should('include', `/admin/clients/${clientId}`)
  cy.get('body', { timeout: 10000 }).should('satisfy', ($body) => {
    const text = $body.text().toLowerCase()
    return text.includes('client') || text.includes('service') || text.includes('invoice')
  })
})

// Fill invoice form with data
Cypress.Commands.add('fillInvoiceForm', (data: InvoiceFormData) => {
  if (data.periodStart) {
    cy.get('input[name="periodStart"], input[placeholder*="Start"]').first().clear().type(data.periodStart)
  }
  if (data.periodEnd) {
    cy.get('input[name="periodEnd"], input[placeholder*="End"]').first().clear().type(data.periodEnd)
  }
  if (data.notes) {
    cy.get('textarea[name="notes"], textarea[placeholder*="notes"]').first().clear().type(data.notes)
  }
})

// Toggle service checkbox in invoice form
Cypress.Commands.add('toggleServiceInInvoice', (serviceName: string) => {
  cy.contains(serviceName).parents('[class*="card"], [class*="service"], .space-y-3').first().within(() => {
    cy.get('[role="checkbox"], input[type="checkbox"]').first().click({ force: true })
  })
})

// ===== VACATION/LEAVE COMMANDS =====

// Create a leave request as admin (with optional auto-approve)
Cypress.Commands.add('createLeaveRequestAdmin', (data: LeaveRequestData) => {
  // Click add request button
  cy.contains('button', /add request|create request|new request/i).click()
  cy.wait(500)

  // Select employee if provided
  if (data.employeeId) {
    cy.get('[data-testid="employee-select"], select[name="employeeId"]').first().then($el => {
      if ($el.is('select')) {
        cy.wrap($el).select(data.employeeId!)
      } else {
        cy.wrap($el).click()
        cy.get('[role="option"], [role="listbox"] button').contains(data.employeeId!).click()
      }
    })
  }

  // Select leave type
  cy.get('[data-testid="leave-type-select"], select[name="leaveTypeId"]').first().then($el => {
    if ($el.is('select')) {
      cy.wrap($el).select(data.leaveTypeId)
    } else {
      cy.wrap($el).click()
      cy.get('[role="option"], [role="listbox"] button').contains(data.leaveTypeId).click()
    }
  })

  // Set dates
  cy.get('input[name="startDate"], input[type="date"]').first().clear().type(data.startDate)
  cy.get('input[name="endDate"], input[type="date"]').last().clear().type(data.endDate)

  // Add reason if provided
  if (data.reason) {
    cy.get('textarea[name="reason"], textarea[placeholder*="reason"]').first().clear().type(data.reason)
  }

  // Toggle auto-approve if requested
  if (data.autoApprove) {
    cy.get('body').then($body => {
      if ($body.find('[data-testid="auto-approve"], input[name="autoApprove"]').length > 0) {
        cy.get('[data-testid="auto-approve"], input[name="autoApprove"]').click({ force: true })
      }
    })
  }

  // Submit
  cy.get('button[type="submit"], button:contains("Submit"), button:contains("Create")').first().click()
})

// Approve a pending leave request
Cypress.Commands.add('approveLeaveRequest', (requestId: string) => {
  cy.get(`[data-request-id="${requestId}"], [data-testid="request-${requestId}"]`).within(() => {
    cy.contains('button', /approve/i).click()
  })
  cy.wait(500)
})

// Deny a pending leave request with reason
Cypress.Commands.add('denyLeaveRequest', (requestId: string, reason: string) => {
  cy.get(`[data-request-id="${requestId}"], [data-testid="request-${requestId}"]`).within(() => {
    cy.contains('button', /deny|reject/i).click()
  })
  cy.wait(300)
  // Fill denial reason in dialog
  cy.get('textarea[name="reason"], textarea[placeholder*="reason"]').first().clear().type(reason)
  cy.contains('button', /confirm|deny|submit/i).click()
})

// Submit employee leave request
Cypress.Commands.add('submitLeaveRequest', (data: LeaveRequestData) => {
  // Select leave type
  cy.get('select[name="leaveTypeId"], [data-testid="leave-type-select"]').first().then($el => {
    if ($el.is('select')) {
      cy.wrap($el).select(data.leaveTypeId)
    } else {
      cy.wrap($el).click()
      cy.get('[role="option"]').contains(data.leaveTypeId).click()
    }
  })

  // Set dates
  cy.get('input[name="startDate"], input[type="date"]').first().clear().type(data.startDate)
  cy.get('input[name="endDate"], input[type="date"]').last().clear().type(data.endDate)

  // Add reason if provided
  if (data.reason) {
    cy.get('textarea[name="reason"]').first().clear().type(data.reason)
  }

  // Submit
  cy.get('button[type="submit"]').click()
})

// ===== REIMBURSEMENT COMMANDS =====

// Submit a reimbursement request
Cypress.Commands.add('submitReimbursement', (data: ReimbursementData) => {
  // Click new request button
  cy.contains('button', /new request|submit request|add request/i).click()
  cy.wait(300)

  // Fill expense amount
  cy.get('input[name="expenseAmount"], input[type="number"]').first().clear().type(data.expenseAmount)

  // Select category if provided
  if (data.category) {
    cy.get('select[name="category"], [data-testid="category-select"]').first().then($el => {
      if ($el.is('select')) {
        cy.wrap($el).select(data.category!)
      } else {
        cy.wrap($el).click()
        cy.get('[role="option"]').contains(data.category!).click()
      }
    })
  }

  // Fill description
  cy.get('textarea[name="description"], input[name="description"]').first().clear().type(data.description)

  // Submit
  cy.get('button[type="submit"]').click()
})

// Approve reimbursement with optional note
Cypress.Commands.add('approveReimbursement', (requestId: number, note?: string) => {
  cy.get(`[data-request-id="${requestId}"], [data-testid="request-${requestId}"], tr:contains("${requestId}")`).first().within(() => {
    cy.contains('button', /approve/i).click()
  })
  cy.wait(300)

  // Add note if provided
  if (note) {
    cy.get('body').then($body => {
      const textarea = $body.find('textarea[name="note"], textarea[placeholder*="note"]')
      if (textarea.length > 0) {
        cy.wrap(textarea).clear().type(note)
      }
    })
  }

  // Confirm approval
  cy.get('body').then($body => {
    const confirmBtn = $body.find('button:contains("Confirm"), button:contains("Submit"), [role="dialog"] button:contains("Approve")')
    if (confirmBtn.length > 0) {
      cy.wrap(confirmBtn.first()).click()
    }
  })
})

// Reject reimbursement with required reason
Cypress.Commands.add('rejectReimbursement', (requestId: number, reason: string) => {
  cy.get(`[data-request-id="${requestId}"], [data-testid="request-${requestId}"], tr:contains("${requestId}")`).first().within(() => {
    cy.contains('button', /reject|deny/i).click()
  })
  cy.wait(300)

  // Fill rejection reason
  cy.get('textarea[name="reason"], textarea[placeholder*="reason"]').first().clear().type(reason)

  // Confirm rejection
  cy.contains('button', /confirm|reject|submit/i).click()
})

// Upload evidence for approved reimbursement
Cypress.Commands.add('uploadReimbursementEvidence', (requestId: number, fileName: string) => {
  cy.get(`[data-request-id="${requestId}"], [data-testid="request-${requestId}"]`).first().within(() => {
    cy.contains('button', /upload|evidence/i).click()
  })
  cy.wait(300)

  // Upload file
  cy.get('input[type="file"]').first().selectFile(`cypress/fixtures/${fileName}`, { force: true })

  // Confirm upload
  cy.get('body').then($body => {
    const submitBtn = $body.find('button:contains("Upload"), button:contains("Submit"), button[type="submit"]')
    if (submitBtn.length > 0) {
      cy.wrap(submitBtn.first()).click()
    }
  })
})

// ===== CLIENT MANAGEMENT COMMANDS =====

// Create a new client
Cypress.Commands.add('createClient', (data: CreateClientData) => {
  cy.contains('button', /add client|create client|new client/i).click()
  cy.wait(300)

  // Fill client name
  cy.get('input[name="name"], input[placeholder*="name"]').first().clear().type(data.name)

  // Fill industry if provided
  if (data.industry) {
    cy.get('input[name="industry"], select[name="industry"]').first().then($el => {
      if ($el.is('select')) {
        cy.wrap($el).select(data.industry!)
      } else {
        cy.wrap($el).clear().type(data.industry!)
      }
    })
  }

  // Set status if provided
  if (data.status) {
    cy.get('select[name="status"], [data-testid="status-select"]').first().then($el => {
      if ($el.is('select')) {
        cy.wrap($el).select(data.status!)
      } else {
        cy.wrap($el).click()
        cy.get('[role="option"]').contains(data.status!).click()
      }
    })
  }

  // Set contract type if provided
  if (data.contractType) {
    cy.get('select[name="contractType"], [data-testid="contract-type-select"]').first().then($el => {
      if ($el.is('select')) {
        cy.wrap($el).select(data.contractType!)
      } else {
        cy.wrap($el).click()
        cy.get('[role="option"]').contains(data.contractType!).click()
      }
    })
  }

  // Submit
  cy.get('button[type="submit"]').click()
})

// Add service to client
Cypress.Commands.add('addServiceToClient', (clientId: number, serviceTypeId: number) => {
  cy.visit(`/admin/clients/${clientId}`)
  cy.wait(1000)

  cy.contains('button', /add service/i).click()
  cy.wait(300)

  // Select service type
  cy.get('select[name="serviceTypeId"], [data-testid="service-type-select"]').first().then($el => {
    if ($el.is('select')) {
      cy.wrap($el).select(serviceTypeId.toString())
    } else {
      cy.wrap($el).click()
      cy.get('[role="option"]').eq(0).click()
    }
  })

  // Submit
  cy.get('button[type="submit"]').click()
})

// ===== FEEDBACK COMMANDS =====

// Submit client feedback with rating
Cypress.Commands.add('submitFeedback', (data: FeedbackData) => {
  // Select service if provided
  if (data.serviceId) {
    cy.get('select[name="serviceId"], [data-testid="service-select"]').first().then($el => {
      if ($el.is('select')) {
        cy.wrap($el).select(data.serviceId!)
      } else {
        cy.wrap($el).click()
        cy.get('[role="option"]').contains(data.serviceId!).click()
      }
    })
    cy.wait(500)
  }

  // Select developer if provided
  if (data.developerId) {
    cy.get('select[name="developerId"], [data-testid="developer-select"]').first().then($el => {
      if ($el.is('select')) {
        cy.wrap($el).select(data.developerId!)
      } else {
        cy.wrap($el).click()
        cy.get('[role="option"]').contains(data.developerId!).click()
      }
    })
  }

  // Set rating (click on star)
  cy.get(`[data-rating="${data.rating}"], button:has(svg.lucide-star):eq(${data.rating - 1})`).click({ force: true })

  // Fill comments
  cy.get('textarea[name="comments"], textarea[placeholder*="comment"]').first().clear().type(data.comments)

  // Submit
  cy.get('button[type="submit"]').click()
})

// Respond to feedback as admin
Cypress.Commands.add('respondToFeedback', (feedbackId: number, response: string) => {
  cy.get(`[data-feedback-id="${feedbackId}"], [data-testid="feedback-${feedbackId}"]`).first().within(() => {
    cy.contains('button', /respond/i).click()
  })
  cy.wait(300)

  // Fill response
  cy.get('textarea[name="response"], textarea[placeholder*="response"]').first().clear().type(response)

  // Submit
  cy.contains('button', /submit|send/i).click()
})

// ===== UTILITY COMMANDS =====

// Wait for loading spinner to disappear
Cypress.Commands.add('waitForLoading', () => {
  cy.get('body').then($body => {
    if ($body.find('[class*="spinner"], [class*="loading"], [role="status"]').length > 0) {
      cy.get('[class*="spinner"], [class*="loading"], [role="status"]', { timeout: 10000 }).should('not.exist')
    }
  })
})

// Assert toast/alert message appears
Cypress.Commands.add('assertAlert', (message: string, type?: 'success' | 'error' | 'warning') => {
  const alertSelector = type
    ? `[role="alert"][class*="${type}"], .toast[class*="${type}"], [data-type="${type}"]`
    : '[role="alert"], .toast, [class*="alert"]'

  cy.get(alertSelector, { timeout: 5000 }).should('contain.text', message)
})

// Select value from custom Select component (Radix UI)
Cypress.Commands.add('selectDropdownValue', (triggerSelector: string, value: string) => {
  cy.get(triggerSelector).click()
  cy.wait(200)
  cy.get('[role="option"], [role="listbox"] button, [data-radix-collection-item]')
    .contains(value)
    .click({ force: true })
})

// Set date input value
Cypress.Commands.add('setDateInput', (selector: string, date: string) => {
  cy.get(selector).clear().type(date)
})

export {}