describe('Admin Approval Workflows', () => {
  beforeEach(() => {
    cy.loginAsAdmin()
  })

  describe('Reimbursement Management', () => {
    it('should view reimbursements page', () => {
      cy.visit('/admin/reimbursements')
      cy.url().should('include', '/reimbursements')

      // Should show reimbursement management page
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('reimbursement') ||
          text.includes('expense') ||
          text.includes('request')
      })
    })

    it('should display reimbursement filters or list', () => {
      cy.visit('/admin/reimbursements')
      cy.wait(2000)

      // Should show filters or requests
      cy.get('body').should('satisfy', ($body) => {
        const hasFilters = $body.find('select').length > 0 ||
          $body.text().includes('Filter') ||
          $body.text().includes('Status') ||
          $body.text().includes('All')
        const hasRequests = $body.text().includes('pending') ||
          $body.text().includes('approved') ||
          $body.text().includes('rejected')
        return hasFilters || hasRequests
      })
    })
  })

  describe('Vacation/Leave Management', () => {
    it('should view vacation requests page', () => {
      cy.visit('/admin/vacation')
      cy.wait(2000)

      // Should show vacation management page
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('vacation') ||
          text.includes('leave') ||
          text.includes('time off') ||
          text.includes('request')
      })
    })

    it('should display pending or all requests', () => {
      cy.visit('/admin/vacation')
      cy.wait(2000)

      // Look for pending requests section
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('pending') ||
          text.includes('request') ||
          text.includes('approval') ||
          text.includes('vacation')
      })
    })
  })

  describe('Admin Dashboard', () => {
    it('should display admin dashboard', () => {
      cy.visit('/admin/dashboard')
      cy.url().should('include', '/admin')

      // Dashboard should show metrics/cards
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('dashboard') ||
          text.includes('team') ||
          text.includes('members') ||
          text.includes('clients') ||
          text.includes('invoices') ||
          text.includes('pending')
      })
    })

    it('should have navigation to reimbursements', () => {
      cy.visit('/admin/dashboard')
      cy.wait(2000)

      // Check for reimbursements link in sidebar or page
      cy.get('body').should('satisfy', ($body) => {
        const hasLink = $body.find('a[href*="reimbursements"]').length > 0
        const hasText = $body.text().toLowerCase().includes('reimbursement')
        return hasLink || hasText
      })
    })

    it('should have navigation to vacation management', () => {
      cy.visit('/admin/dashboard')
      cy.wait(2000)

      // Check for vacation link in sidebar or page
      cy.get('body').should('satisfy', ($body) => {
        const hasLink = $body.find('a[href*="vacation"]').length > 0
        const hasText = $body.text().toLowerCase().includes('vacation') ||
          $body.text().toLowerCase().includes('leave')
        return hasLink || hasText
      })
    })
  })

  describe('Team Management', () => {
    it('should view team page', () => {
      cy.visit('/admin/team')
      cy.wait(2000)

      // Should show team management page
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('team') ||
          text.includes('member') ||
          text.includes('employee')
      })
    })
  })
})
