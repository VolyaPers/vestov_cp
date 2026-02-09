describe('Simple Page Load Test', () => {
  const adminRoutes = [
    '/admin/dashboard',
    '/admin/services',
    '/admin/clients',
    '/admin/team',
    '/admin/vacation'
  ]

  adminRoutes.forEach((route) => {
    it(`should load ${route} without critical errors`, () => {
      // Visit the page
      cy.visit(route, { failOnStatusCode: false })

      // Wait for the page to load
      cy.wait(2000)

      // Check that we get some response (either login page or actual content)
      cy.get('body').should('exist').and('be.visible')

      // Verify there's no completely blank page or critical error
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text()
        return text.length > 100 // Page should have some meaningful content
      })

      // Check for specific error messages that would indicate page issues
      cy.get('body').should('not.contain', 'Cannot read property')
      cy.get('body').should('not.contain', 'ReferenceError')
      cy.get('body').should('not.contain', 'TypeError')
      cy.get('body').should('not.contain', 'Failed to resolve import')

      // Log what we see for debugging
      cy.get('body').then(($body) => {
        const text = $body.text()
        if (text.includes('Login') || text.includes('Username')) {
          cy.log(`${route}: Shows login form (authentication required)`)
        } else if (text.includes('Admin') || text.includes('Dashboard') || text.includes('Team') || text.includes('Client') || text.includes('Service') || text.includes('Vacation')) {
          cy.log(`${route}: Shows admin content (page loaded successfully)`)
        } else {
          cy.log(`${route}: Shows unexpected content: ${text.substring(0, 100)}...`)
        }
      })
    })
  })

  it('should handle navigation between admin routes', () => {
    // Start with dashboard
    cy.visit('/admin/dashboard')
    cy.wait(2000)

    // Try to navigate to other pages by URL
    adminRoutes.slice(1).forEach((route) => {
      cy.visit(route)
      cy.wait(1000)

      // Verify we can navigate without crashes
      cy.url().should('include', route)
      cy.get('body').should('exist').and('be.visible')
    })
  })

  it('should not have import/export errors in the console', () => {
    // Capture console errors
    const consoleErrors = []
    cy.window().then((win) => {
      cy.stub(win.console, 'error').callsFake((message) => {
        consoleErrors.push(message)
      })
    })

    // Visit each page and check for import/export errors
    adminRoutes.forEach((route) => {
      cy.visit(route)
      cy.wait(2000)

      // Check for specific import/export errors
      cy.then(() => {
        const importExportErrors = consoleErrors.filter(error =>
          typeof error === 'string' && (
            error.includes('does not provide an export') ||
            error.includes('Failed to resolve import') ||
            error.includes('Uncaught SyntaxError') ||
            error.includes('Cannot resolve module')
          )
        )

        if (importExportErrors.length > 0) {
          throw new Error(`Import/Export errors found on ${route}: ${importExportErrors.join(', ')}`)
        }
      })
    })
  })
})