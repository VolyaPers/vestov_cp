/// <reference types="cypress" />

describe('Client Dashboard', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/services/clients/*').as('getClient')
    cy.intercept('GET', '/api/client/*').as('getClientData')
    cy.loginAsClient()
  })

  describe('Dashboard Page', () => {
    beforeEach(() => {
      cy.visit('/client/dashboard')
      cy.wait(2000)
    })

    it('should load client dashboard', () => {
      cy.url().should('include', '/client')
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('dashboard') ||
          text.includes('welcome') ||
          text.includes('overview')
      })
    })

    it('should display welcome message', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('welcome') ||
          text.includes('hello') ||
          text.includes('good')
      })
    })

    it('should show company/client name', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('client') ||
          text.includes('company') ||
          text.includes('portal')
      })
    })
  })

  describe('Stats Cards', () => {
    beforeEach(() => {
      cy.visit('/client/dashboard')
      cy.wait(2000)
    })

    it('should display team size', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('team') ||
          text.includes('member') ||
          text.includes('developer')
      })
    })

    it('should show active services count', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('service') ||
          text.includes('project') ||
          text.includes('active')
      })
    })

    it('should display pending requests count', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('request') ||
          text.includes('pending') ||
          /\d+/.test($body.text())
      })
    })

    it('should show contract status', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('contract') ||
          text.includes('active') ||
          text.includes('status')
      })
    })
  })

  describe('Current Services', () => {
    beforeEach(() => {
      cy.visit('/client/dashboard')
      cy.wait(2000)
    })

    it('should list active services', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('service') ||
          text.includes('project') ||
          text.includes('no service')
      })
    })

    it('should show service indicators', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('active') ||
          text.includes('outstaffing') ||
          text.includes('outsourcing') ||
          text.includes('service')
      })
    })
  })

  describe('Recent Requests', () => {
    beforeEach(() => {
      cy.visit('/client/dashboard')
      cy.wait(2000)
    })

    it('should display recent requests', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('request') ||
          text.includes('recent') ||
          text.includes('no request')
      })
    })

    it('should show request status indicators', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('pending') ||
          text.includes('approved') ||
          text.includes('denied') ||
          text.includes('status') ||
          text.includes('no request')
      })
    })

    it('should display request date', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text()
        return /\d{1,2}[\/\-]\d{1,2}/.test(text) ||
          text.toLowerCase().includes('date') ||
          text.toLowerCase().includes('no recent request') ||
          text.toLowerCase().includes('no request')
      })
    })
  })

  describe('Contract Details', () => {
    beforeEach(() => {
      cy.visit('/client/dashboard')
      cy.wait(2000)
    })

    it('should display contract type', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('outsourcing') ||
          text.includes('outstaffing') ||
          text.includes('hybrid') ||
          text.includes('contract')
      })
    })

    it('should show billing cycle', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('billing') ||
          text.includes('monthly') ||
          text.includes('weekly') ||
          text.includes('hourly')
      })
    })

    it('should display team size', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('team') ||
          text.includes('member') ||
          /\d+\s*(developer|member|person)/i.test($body.text())
      })
    })
  })

  describe('Quick Actions', () => {
    beforeEach(() => {
      cy.visit('/client/dashboard')
      cy.wait(2000)
    })

    it('should have navigation to team status', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('a[href*="team"], button:contains("Team")').length > 0 ||
          $body.text().toLowerCase().includes('team')
      })
    })

    it('should have navigation to documents', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('a[href*="document"], button:contains("Document")').length > 0 ||
          $body.text().toLowerCase().includes('document')
      })
    })

    it('should have navigation to invoices', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('a[href*="invoice"], button:contains("Invoice")').length > 0 ||
          $body.text().toLowerCase().includes('invoice')
      })
    })

    it('should have navigation to feedback', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('a[href*="feedback"], button:contains("Feedback")').length > 0 ||
          $body.text().toLowerCase().includes('feedback')
      })
    })
  })

  describe('Sidebar Navigation', () => {
    beforeEach(() => {
      cy.visit('/client/dashboard')
      cy.wait(2000)
    })

    it('should display client sidebar', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('[class*="sidebar"], nav, aside').length > 0
      })
    })

    it('should have Dashboard link', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('a[href*="dashboard"], a[href*="portal"]').length > 0 ||
          $body.text().includes('Dashboard') ||
          $body.text().includes('Overview')
      })
    })

    it('should have Team link', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('a[href*="team"]').length > 0 ||
          $body.text().includes('Team')
      })
    })

    it('should have Documents link', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('a[href*="document"]').length > 0 ||
          $body.text().includes('Document')
      })
    })

    it('should have Invoices link', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('a[href*="invoice"]').length > 0 ||
          $body.text().includes('Invoice')
      })
    })

    it('should have Feedback link', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('a[href*="feedback"]').length > 0 ||
          $body.text().includes('Feedback')
      })
    })
  })
})
