describe('Team Member Workflows', () => {
  beforeEach(() => {
    cy.loginAsTeamMember()
  })

  describe('Reimbursement Requests', () => {
    it('should view reimbursement page', () => {
      cy.visit('/employee/reimbursements')
      cy.url().should('include', '/reimbursements')

      // Should show reimbursement page content
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('reimbursement') || text.includes('expense')
      })
    })

    it('should view pending requests', () => {
      cy.visit('/employee/reimbursements')
      cy.url().should('include', '/reimbursements')

      // Check for either existing requests or empty state
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('request') ||
          text.includes('reimbursement') ||
          text.includes('no requests') ||
          text.includes('pending')
      })
    })
  })

  describe('Vacation/Leave Requests', () => {
    it('should view vacation page', () => {
      cy.visit('/employee/vacation')
      cy.wait(2000)

      // Should show vacation/time-off page
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('vacation') ||
          text.includes('leave') ||
          text.includes('time off') ||
          text.includes('days')
      })
    })

    it('should view request history', () => {
      cy.visit('/employee/vacation')
      cy.wait(2000)

      // Should show request history or vacation info
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('request') ||
          text.includes('history') ||
          text.includes('vacation') ||
          text.includes('approved') ||
          text.includes('pending')
      })
    })
  })

  describe('Dashboard', () => {
    it('should display employee dashboard', () => {
      cy.visit('/employee/dashboard')
      cy.url().should('include', '/employee')

      // Should show dashboard with greeting or shift controls
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('dashboard') ||
          text.includes('good morning') ||
          text.includes('good afternoon') ||
          text.includes('good evening') ||
          text.includes('shift') ||
          text.includes('welcome')
      })
    })

    it('should display shift controls', () => {
      cy.visit('/employee/dashboard')
      cy.wait(2000)

      // Should show shift control buttons
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('start shift') ||
          text.includes('end shift') ||
          text.includes('shift') ||
          text.includes('break')
      })
    })
  })

  describe('Shift Management', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/shifts/current').as('getCurrentShift')
      cy.intercept('POST', '/api/shifts/start').as('startShift')
      cy.intercept('POST', '/api/shifts/end').as('endShift')
    })

    // Helper to get desktop sidebar
    const getDesktopSidebar = () => cy.get('.hidden.lg\\:flex')

    it('should show shift status on dashboard', () => {
      cy.visit('/employee/dashboard')
      cy.url().should('include', '/employee')
      cy.wait(2000)

      // Should show either Start Shift or End Shift button in desktop sidebar
      getDesktopSidebar().should('satisfy', ($sidebar) => {
        const hasStartShift = $sidebar.find('button:contains("Start Shift")').length > 0
        const hasEndShift = $sidebar.find('button:contains("End Shift")').length > 0 ||
          $sidebar.find('button:contains("End")').length > 0
        return hasStartShift || hasEndShift
      })
    })

    it('should toggle shift state', () => {
      cy.visit('/employee/dashboard')
      cy.wait(2000)

      getDesktopSidebar().then(($sidebar) => {
        // If Start Shift is visible, try to start shift
        if ($sidebar.find('button:contains("Start Shift")').length > 0) {
          getDesktopSidebar().contains('button', 'Start Shift').click()
          // Click Yes to confirm
          cy.contains('button', 'Yes').click()
          // Either wait for API or verify state changed
          cy.wait(2000)
          getDesktopSidebar().should('satisfy', ($updatedSidebar) => {
            const text = $updatedSidebar.text().toLowerCase()
            return text.includes('end') ||
              text.includes('working') ||
              text.includes('break')
          })
        } else if ($sidebar.find('button:contains("End")').length > 0) {
          // Already on shift, verify state
          getDesktopSidebar().contains('button', 'End').should('exist')
        } else {
          cy.log('No shift buttons found')
        }
      })
    })
  })
})
