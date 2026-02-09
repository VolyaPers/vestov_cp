describe('Client Portal - Essential Information Test', () => {
  it('should login as kamran and verify client portal functionality', () => {
    // Clear any existing session
    cy.clearCookies()
    cy.clearLocalStorage()

    // Visit root and login
    cy.visit('/')
    cy.wait(2000)

    // Login as kamran/kamran123
    cy.get('input[name="username"]').should('be.visible').clear().type('kamran')
    cy.get('input[name="password"]').should('be.visible').clear().type('kamran123')
    cy.get('button[type="submit"]').click()

    // Wait for login and redirect
    cy.wait(5000)

    // Should be on client portal page
    cy.url().should('include', '/client/')

    // Check basic client portal elements
    cy.contains('Client Portal').should('be.visible')
    cy.contains('Chronogrid').should('be.visible')

    // Test navigation items exist
    cy.contains('Overview').should('be.visible')
    cy.contains('Documents').should('be.visible')
    cy.contains('Invoices').should('be.visible')
    cy.contains('Profile').should('be.visible')

    // Test Documents page
    cy.contains('Documents').click()
    cy.wait(2000)
    cy.url().should('include', '/client/documents')
    cy.get('h1').should('contain', 'Documents')

    // Test Invoices page
    cy.contains('Invoices').click()
    cy.wait(2000)
    cy.url().should('include', '/client/invoices')
    cy.get('h1').should('contain', 'Invoices')

    // Test Profile page
    cy.contains('Profile').click()
    cy.wait(2000)
    cy.url().should('include', '/client/profile')
    cy.get('h1').should('contain', 'Profile')
    cy.contains('John Smith').should('be.visible')

    // Go back to Overview
    cy.contains('Overview').click()
    cy.wait(2000)
    cy.url().should('include', '/client/portal')
    cy.contains('Chronogrid').should('be.visible')

    // Verify read-only access indicators
    cy.contains('read-only access').should('be.visible')

    // Test logout
    cy.get('[title="Sign out"]').should('be.visible').click()
    cy.wait(3000)
    cy.url().should('include', '/login')
  })

  it('should verify client data is displayed correctly', () => {
    // Login first
    cy.visit('/')
    cy.wait(2000)

    cy.get('input[name="username"]').clear().type('kamran')
    cy.get('input[name="password"]').clear().type('kamran123')
    cy.get('button[type="submit"]').click()
    cy.wait(5000)

    // Check overview cards are displayed
    cy.contains('Team Size').should('be.visible')
    cy.contains('Active Services').should('be.visible')
    cy.contains('Documents').should('be.visible')
    cy.contains('Invoices').should('be.visible')

    // Check contract information section exists
    cy.contains('Contract Information').should('be.visible')

    // Check services section exists
    cy.contains('Your Services').should('be.visible')

    // Verify no edit buttons (read-only)
    cy.get('body').should('not.contain', 'Edit')
    cy.get('body').should('not.contain', 'Add')
    cy.get('body').should('not.contain', 'Create')

    // Check client name is displayed correctly
    cy.get('h1').should('contain', 'Chronogrid')
  })
})