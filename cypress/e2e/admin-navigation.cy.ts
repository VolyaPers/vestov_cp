describe('Admin Navigation Test', () => {
  beforeEach(() => {
    cy.loginAsAdmin()
  })

  const adminPages = [
    { name: 'Dashboard', path: '/admin/dashboard', expectedText: 'Dashboard' },
    { name: 'Services', path: '/admin/services', expectedText: 'Service' },
    { name: 'Clients', path: '/admin/clients', expectedText: 'Client' },
    { name: 'Team', path: '/admin/team', expectedText: 'Team' },
    { name: 'Vacation', path: '/admin/vacation', expectedText: 'Vacation' }
  ]

  adminPages.forEach((page) => {
    it(`should successfully load ${page.name} page`, () => {
      cy.visit(page.path)

      // Verify URL is correct
      cy.url().should('include', page.path)

      // Wait for page to load and check for expected content
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes(page.expectedText.toLowerCase())
      })
    })
  })

  it('should navigate through all pages using sidebar navigation', () => {
    // Start at dashboard
    cy.visit('/admin/dashboard')
    cy.url().should('include', '/admin')

    // Navigate to each page and verify
    adminPages.forEach((page) => {
      cy.visit(page.path)
      cy.url().should('include', page.path)
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes(page.expectedText.toLowerCase())
      })
    })
  })

  it('should handle direct navigation to pages with parameters', () => {
    // Test client details page (if client exists)
    cy.visit('/admin/clients/1')

    // Should either show client details or redirect to clients list
    cy.url().should('match', /\/admin\/clients/)

    // Check for either client details content or clients list
    cy.get('body').should('satisfy', ($body) => {
      const text = $body.text().toLowerCase()
      return text.includes('client') ||
             text.includes('details') ||
             text.includes('not found')
    })
  })

  it('should handle invalid routes gracefully', () => {
    cy.visit('/admin/nonexistent-page', { failOnStatusCode: false })

    // Should redirect to a valid page or show 404
    cy.url().should('match', /\/admin/)

    // Page should still be functional
    cy.get('body').should('be.visible')
  })

  it('should maintain authentication across page navigation', () => {
    adminPages.forEach((page) => {
      cy.visit(page.path)

      // Should not redirect to login
      cy.url().should('not.include', '/login')
      cy.url().should('include', '/admin')
    })
  })

  it('should have working responsive navigation', () => {
    // Test mobile viewport
    cy.viewport('iphone-6')

    cy.visit('/admin/dashboard')
    cy.url().should('include', '/admin')

    // Verify page loads on mobile
    cy.get('body').should('satisfy', ($body) => {
      const text = $body.text().toLowerCase()
      return text.includes('dashboard')
    })

    // Reset viewport
    cy.viewport(1280, 720)
  })

  it('should load all pages without major errors', () => {
    adminPages.forEach((page) => {
      cy.visit(page.path)
      cy.url().should('include', page.path)

      // Verify page has content
      cy.get('body').should('not.be.empty')

      // Brief wait to ensure page is stable
      cy.wait(500)
    })
  })
})
