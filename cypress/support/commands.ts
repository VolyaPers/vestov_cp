/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Login as admin user
       */
      loginAsAdmin(): Chainable<void>
      
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

// Login as admin
Cypress.Commands.add('loginAsAdmin', () => {
  cy.session('admin-login', () => {
    cy.visit('/')
    cy.get('input[id="username"]').type('admin')
    cy.get('input[id="password"]').type('admin123')
    cy.get('button[type="submit"]').click()
    cy.url().should('not.include', '/login')
    cy.contains('Admin Dashboard', { timeout: 10000 }).should('be.visible')
  })
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
  cy.contains('Chronogrid', { timeout: 10000 }).should('be.visible')
})

// Open create invoice dialog
Cypress.Commands.add('openCreateInvoiceDialog', () => {
  cy.contains('button', 'Create Invoice').click()
  cy.contains('Create Invoice for Chronogrid', { timeout: 10000 }).should('be.visible')
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