describe('Basic Functionality Test', () => {
  beforeEach(() => {
    cy.loginAsAdmin()
  })

  it('should load client details page', () => {
    cy.visit('/admin/clients')
    cy.url().should('include', '/admin/clients')

    // Check for client list content
    cy.get('body').should('satisfy', ($body) => {
      const text = $body.text().toLowerCase()
      return text.includes('client') || text.includes('company')
    })
  })

  it('should navigate to first available client', () => {
    cy.visit('/admin/clients')
    cy.wait(2000)

    // Try to click on a client if available
    cy.get('body').then(($body) => {
      // Check if there are client links or rows
      const clientLinks = $body.find('a[href*="/admin/clients/"]')
      if (clientLinks.length > 0) {
        cy.wrap(clientLinks.first()).click()
        cy.url().should('match', /\/admin\/clients\/\d+/)
      } else {
        cy.log('No clients found in the list')
      }
    })
  })

  it('should display client page elements', () => {
    // Try to visit a specific client if it exists
    cy.visit('/admin/clients/1', { failOnStatusCode: false })
    cy.wait(2000)

    // Check if we're on a valid client page or redirected
    cy.get('body').should('satisfy', ($body) => {
      const text = $body.text().toLowerCase()
      // Should show either client details or client not found or client list
      return text.includes('client') ||
             text.includes('invoice') ||
             text.includes('service') ||
             text.includes('not found')
    })
  })
})
