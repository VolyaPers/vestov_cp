describe('Admin Impersonation', () => {
  beforeEach(() => {
    cy.loginAsAdmin()
    cy.visit('/admin/dashboard')
    cy.wait(2000)
  })

  // Helper to get desktop sidebar
  const getDesktopSidebar = () => cy.get('.hidden.lg\\:flex')

  describe('Impersonation Widget Visibility', () => {
    it('should show "Switch to User" button for admin users', () => {
      // Wait for sidebar to load
      cy.get('body').should('contain.text', 'Super Admin')

      // Should show the Switch to User button in desktop sidebar
      getDesktopSidebar().contains('button', 'Switch to User').should('be.visible')
    })

    it('should not show impersonation widget for non-admin users', () => {
      // Login as team member
      cy.clearCookies()
      cy.loginAsTeamMember()
      cy.visit('/employee/dashboard')
      cy.wait(2000)

      // Should NOT have the Super Admin section
      cy.get('body').should('not.contain.text', 'Super Admin')
      cy.contains('button', 'Switch to User').should('not.exist')
    })
  })

  describe('Impersonation Flow', () => {
    beforeEach(() => {
      cy.intercept('POST', '/api/impersonate/*').as('impersonate')
      cy.intercept('GET', '/api/users*').as('getUsers')
    })

    it('should show user list when clicking Switch to User', () => {
      // Click the Switch to User button in desktop sidebar
      getDesktopSidebar().contains('button', 'Switch to User').click()

      // Wait for users to load
      cy.wait('@getUsers')

      // Should show "Select User:" text
      getDesktopSidebar().contains('Select User:').should('be.visible')

      // Should show at least one user to impersonate
      getDesktopSidebar().find('.max-h-64 button').should('have.length.greaterThan', 0)
    })

    it('should show Cancel button to close user list', () => {
      getDesktopSidebar().contains('button', 'Switch to User').click()
      cy.wait('@getUsers')

      // Should show Cancel button
      getDesktopSidebar().contains('button', 'Cancel').should('be.visible')

      // Click Cancel
      getDesktopSidebar().contains('button', 'Cancel').click()

      // User list should be hidden
      getDesktopSidebar().contains('Select User:').should('not.exist')

      // Switch to User button should be visible again
      getDesktopSidebar().contains('button', 'Switch to User').should('be.visible')
    })

    it('should impersonate a team member user', () => {
      getDesktopSidebar().contains('button', 'Switch to User').click()
      cy.wait('@getUsers')

      // Find and click on a team member user (look for "team_member" role text)
      getDesktopSidebar().find('.max-h-64 button').then($buttons => {
        // Find a button that contains "team_member" role
        const teamMemberButton = $buttons.filter((_, el) => {
          return el.innerText.toLowerCase().includes('team_member')
        }).first()

        if (teamMemberButton.length > 0) {
          cy.wrap(teamMemberButton).click()

          // Wait for impersonation API call
          cy.wait('@impersonate').its('response.statusCode').should('eq', 200)

          // Should redirect to employee dashboard
          cy.url({ timeout: 10000 }).should('include', '/employee')
        } else {
          cy.log('No team member user found to impersonate')
        }
      })
    })

    it('should impersonate a client user', () => {
      getDesktopSidebar().contains('button', 'Switch to User').click()
      cy.wait('@getUsers')

      // Find and click on a client user
      getDesktopSidebar().find('.max-h-64 button').then($buttons => {
        const clientButton = $buttons.filter((_, el) => {
          const text = el.innerText.toLowerCase()
          return text.includes('client') && !text.includes('team_member') && !text.includes('admin')
        }).first()

        if (clientButton.length > 0) {
          cy.wrap(clientButton).click()

          // Wait for impersonation API call
          cy.wait('@impersonate').its('response.statusCode').should('eq', 200)

          // Should redirect to client portal
          cy.url({ timeout: 10000 }).should('include', '/client')
        } else {
          cy.log('No client user found to impersonate')
        }
      })
    })
  })

  describe('Stop Impersonation', () => {
    beforeEach(() => {
      cy.intercept('POST', '/api/impersonate/*').as('impersonate')
      cy.intercept('POST', '/api/stop-impersonation').as('stopImpersonation')
      cy.intercept('GET', '/api/users*').as('getUsers')
    })

    it('should show Stop button when impersonating', () => {
      // Start impersonating
      getDesktopSidebar().contains('button', 'Switch to User').click()
      cy.wait('@getUsers')

      // Click first available user
      getDesktopSidebar().find('.max-h-64 button').first().click()
      cy.wait('@impersonate')

      // Wait for page to load after impersonation
      cy.wait(2000)

      // Should show Impersonating section with Stop button (in the new page's sidebar)
      cy.get('.hidden.lg\\:flex').contains('Impersonating').should('be.visible')
      cy.get('.hidden.lg\\:flex').contains('button', 'Stop').should('be.visible')
    })

    it('should return to admin dashboard when stopping impersonation', () => {
      // Start impersonating
      getDesktopSidebar().contains('button', 'Switch to User').click()
      cy.wait('@getUsers')

      getDesktopSidebar().find('.max-h-64 button').first().click()
      cy.wait('@impersonate')
      cy.wait(2000)

      // Click Stop button (in the new page's sidebar)
      cy.get('.hidden.lg\\:flex').contains('button', 'Stop').click()
      cy.wait('@stopImpersonation').its('response.statusCode').should('eq', 200)

      // Should return to admin dashboard
      cy.url({ timeout: 10000 }).should('include', '/admin')

      // Should show Switch to User again (not impersonating anymore)
      cy.get('.hidden.lg\\:flex').contains('button', 'Switch to User', { timeout: 10000 }).should('be.visible')
    })
  })
})
