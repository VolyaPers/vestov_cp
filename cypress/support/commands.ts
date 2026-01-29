/// <reference types="cypress" />

// Type definitions for user creation
interface CreateUserData {
  username: string
  password: string
  fullName: string
  email: string
  role: 'admin' | 'team_member' | 'client'
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
    }
  }
}

// Generic login command
Cypress.Commands.add('login', (username: string, password: string) => {
  cy.session(`login-${username}`, () => {
    cy.visit('/')
    cy.get('input[id="username"]').type(username)
    cy.get('input[id="password"]').type(password)
    cy.get('button[type="submit"]').click()
    cy.url().should('not.include', '/login')
    // Wait for any dashboard to load
    cy.get('body', { timeout: 10000 }).should('contain.text', 'Dashboard')
  })
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
  cy.session('client-login', () => {
    cy.visit('/')
    cy.get('input[id="username"]').type('client')
    cy.get('input[id="password"]').type('client123')
    cy.get('button[type="submit"]').click()
    cy.url().should('not.include', '/login')
    // Client dashboard or root
    cy.url({ timeout: 10000 }).should('satisfy', (url: string) => {
      return url.includes('/client') || url === Cypress.config().baseUrl + '/'
    })
  })
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

export {}