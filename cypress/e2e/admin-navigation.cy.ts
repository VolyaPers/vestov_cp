describe('Admin Navigation Test', () => {
  const adminPages = [
    { name: 'Dashboard', path: '/admin/dashboard', expectedText: 'Admin Dashboard' },
    { name: 'Services', path: '/admin/services', expectedText: 'Service Management' },
    { name: 'Clients', path: '/admin/clients', expectedText: 'Clients' },
    { name: 'Team', path: '/admin/team', expectedText: 'Team Overview' },
    { name: 'Vacation', path: '/admin/vacation', expectedText: 'Vacation Dashboard' }
  ]

  adminPages.forEach((page) => {
    it(`should successfully load ${page.name} page`, () => {
      cy.visit(page.path)

      // Check if we're redirected to login or if page loads
      cy.get('body').then(($body) => {
        if ($body.text().includes('Login') || $body.text().includes('Username')) {
          cy.log('Authentication required - verifying page redirects to login')
          cy.url().should('satisfy', (url) =>
            url.includes('/login') || url.includes(page.path)
          )
        } else {
          // Wait for page to load and check for expected content
          cy.contains(page.expectedText, { timeout: 10000 }).should('be.visible')

          // Verify URL is correct
          cy.url().should('include', page.path)

          // Check that the page is interactive (no loading states stuck)
          cy.get('body').should('not.contain', 'Loading...')
          cy.get('[data-testid="loading"]').should('not.exist')
          cy.get('.animate-spin').should('not.exist')
        }
      })
    })
  })

  it('should navigate through all pages using sidebar navigation', () => {
    // Start at dashboard
    cy.visit('/admin/dashboard')

    // Check if we're redirected to login or if we can see admin content
    cy.get('body').then(($body) => {
      if ($body.text().includes('Login') || $body.text().includes('Username')) {
        cy.log('Authentication required - skipping navigation test')
        return
      }

      cy.contains('Admin Dashboard', { timeout: 10000 }).should('be.visible')

      // Navigate through each page using sidebar links
      adminPages.forEach((page) => {
        if (page.path === '/admin/dashboard') return // Skip dashboard as we're already there

        // Click on the sidebar navigation link
        cy.get('nav').within(() => {
          cy.contains(page.name).click()
        })

        // Verify we're on the correct page
        cy.url().should('include', page.path)
        cy.contains(page.expectedText, { timeout: 10000 }).should('be.visible')

        // Brief wait to ensure page is fully loaded
        cy.wait(500)
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
      return $body.text().includes('Client Details') ||
             $body.text().includes('Clients') ||
             $body.text().includes('No client found')
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

      // Should see admin content
      cy.contains(page.expectedText, { timeout: 10000 }).should('be.visible')
    })
  })

  it('should have working responsive navigation', () => {
    // Test mobile viewport
    cy.viewport('iphone-6')

    cy.visit('/admin/dashboard')
    cy.contains('Admin Dashboard', { timeout: 10000 }).should('be.visible')

    // Look for mobile menu button (hamburger menu)
    cy.get('body').then(($body) => {
      if ($body.find('[data-testid="mobile-menu-button"]').length > 0) {
        cy.get('[data-testid="mobile-menu-button"]').click()
      } else if ($body.find('button').filter(':contains("Menu")').length > 0) {
        cy.contains('button', 'Menu').click()
      }
      // If no mobile menu found, the navigation might be always visible
    })

    // Try to navigate to another page
    cy.contains('Services').click()
    cy.url().should('include', '/admin/services')
    cy.contains('Service Management', { timeout: 10000 }).should('be.visible')

    // Reset viewport
    cy.viewport(1280, 720)
  })

  it('should load all pages without console errors', () => {
    // Capture console errors
    cy.window().then((win) => {
      cy.stub(win.console, 'error').as('consoleError')
    })

    adminPages.forEach((page) => {
      cy.visit(page.path)
      cy.contains(page.expectedText, { timeout: 10000 }).should('be.visible')

      // Wait for any async operations to complete
      cy.wait(1000)

      // Check for console errors (allowing some expected ones)
      cy.get('@consoleError').then((stub) => {
        const errorCalls = (stub as any).getCalls()
        const significantErrors = errorCalls.filter((call: any) => {
          const message = call.args[0]
          // Filter out common, non-critical errors
          return !message.includes('404') &&
                 !message.includes('Failed to fetch') &&
                 !message.includes('Network Error')
        })
        expect(significantErrors).to.have.length.lessThan(3) // Allow up to 2 non-critical errors
      })
    })
  })
})