describe('Client Portal - Session-Aware Test', () => {
  it('should handle client portal access (with or without login)', () => {
    // Visit root URL
    cy.visit('/')
    cy.wait(3000)

    // Check what we see on the page
    cy.get('body').then(($body) => {
      const bodyText = $body.text()

      if (bodyText.includes('username') || bodyText.includes('password') || bodyText.includes('Login')) {
        // We see a login form, so login
        cy.log('Found login form, logging in')
        cy.get('input[name="username"]').type('kamran')
        cy.get('input[name="password"]').type('kamran123')
        cy.get('button[type="submit"]').click()
        cy.wait(5000)
      } else if (bodyText.includes('Client Portal') || bodyText.includes('Chronogrid')) {
        // Already logged in as client
        cy.log('Already logged in as client')
      } else if (bodyText.includes('Admin') || bodyText.includes('Dashboard')) {
        // Logged in as admin, need to logout and login as client
        cy.log('Logged in as admin, logging out')
        cy.get('[title="Sign out"]').click()
        cy.wait(2000)
        cy.get('input[name="username"]').type('kamran')
        cy.get('input[name="password"]').type('kamran123')
        cy.get('button[type="submit"]').click()
        cy.wait(5000)
      } else {
        // Unknown state, try to navigate to login
        cy.log('Unknown state, visiting login')
        cy.visit('/login')
        cy.wait(2000)
        cy.get('input[name="username"]').type('kamran')
        cy.get('input[name="password"]').type('kamran123')
        cy.get('button[type="submit"]').click()
        cy.wait(5000)
      }
    })

    // Now we should be on the client portal
    cy.url().should('include', '/client/')

    // Verify client portal elements
    cy.contains('Chronogrid').should('be.visible')
    cy.contains('Client Portal').should('be.visible')

    // Test navigation
    cy.log('Testing navigation items')
    cy.contains('Overview').should('be.visible')
    cy.contains('Documents').should('be.visible')
    cy.contains('Invoices').should('be.visible')
    cy.contains('Profile').should('be.visible')

    // Test Documents page
    cy.log('Testing Documents page')
    cy.contains('Documents').click()
    cy.wait(2000)
    cy.url().should('include', '/documents')
    cy.get('h1').should('contain', 'Documents')

    // Test Invoices page
    cy.log('Testing Invoices page')
    cy.contains('Invoices').click()
    cy.wait(2000)
    cy.url().should('include', '/invoices')
    cy.get('h1').should('contain', 'Invoices')

    // Test Profile page
    cy.log('Testing Profile page')
    cy.contains('Profile').click()
    cy.wait(2000)
    cy.url().should('include', '/profile')
    cy.get('h1').should('contain', 'Profile')

    // Check user information on profile
    cy.contains('John Smith').should('be.visible')
    cy.contains('Client Role').should('be.visible')

    // Go back to Overview
    cy.log('Going back to Overview')
    cy.contains('Overview').click()
    cy.wait(2000)
    cy.url().should('include', '/portal')

    // Verify overview data
    cy.contains('Team Size').should('be.visible')
    cy.contains('Active Services').should('be.visible')
    cy.contains('Contract Information').should('be.visible')
    cy.contains('Your Services').should('be.visible')

    // Verify read-only access
    cy.contains('read-only').should('be.visible')
  })

  it('should verify no admin functionality is accessible', () => {
    // Start from wherever we are
    cy.visit('/client/portal')
    cy.wait(3000)

    // Should not be able to access admin routes
    cy.visit('/admin/dashboard')
    cy.wait(2000)
    cy.get('body').should('contain', 'Access denied')

    // Go back to client portal
    cy.visit('/client/portal')
    cy.wait(2000)

    // Verify no admin buttons or edit functionality
    cy.get('body').should('not.contain', 'Add User')
    cy.get('body').should('not.contain', 'Edit Client')
    cy.get('body').should('not.contain', 'Delete')
    cy.get('body').should('not.contain', 'Admin')
  })
})