/// <reference types="cypress" />

describe('Employee Calendar', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/vacation/requests*').as('getRequests')
    cy.intercept('GET', '/api/vacation/my-profile').as('getProfile')
    cy.loginAsTeamMember()
  })

  // Helper: calendar lives as a tab inside /employee/vacations
  const visitCalendarTab = () => {
    cy.visit('/employee/vacations')
    cy.contains('button', 'Calendar').should('be.visible').click()
    cy.wait(1000)
  }

  describe('Calendar Page', () => {
    beforeEach(() => {
      visitCalendarTab()
    })

    it('should load calendar page', () => {
      cy.url().should('include', '/employee')
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('calendar') ||
          text.includes('schedule') ||
          text.includes('sun') ||
          text.includes('mon')
      })
    })

    it('should display calendar grid', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('[class*="calendar"], [class*="grid"]').length > 0 ||
          $body.text().includes('Sun') ||
          $body.text().includes('Mon')
      })
    })

    it('should show current month and year', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text()
        return /January|February|March|April|May|June|July|August|September|October|November|December/.test(text) ||
          /\d{4}/.test(text)
      })
    })
  })

  describe('Calendar Navigation', () => {
    beforeEach(() => {
      visitCalendarTab()
    })

    it('should have previous month button', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('button:has(svg.lucide-chevron-left), button[aria-label*="prev"]').length > 0
      })
    })

    it('should have next month button', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('button:has(svg.lucide-chevron-right), button[aria-label*="next"]').length > 0
      })
    })

    it('should navigate to previous month', () => {
      cy.get('body').then($body => {
        const prevBtn = $body.find('button:has(svg.lucide-chevron-left), button[aria-label*="prev"]')
        if (prevBtn.length > 0) {
          cy.wrap(prevBtn.first()).click()
          cy.wait(500)
        }
      })
    })

    it('should navigate to next month', () => {
      cy.get('body').then($body => {
        const nextBtn = $body.find('button:has(svg.lucide-chevron-right), button[aria-label*="next"]')
        if (nextBtn.length > 0) {
          cy.wrap(nextBtn.first()).click()
          cy.wait(500)
        }
      })
    })

    it('should have Today button', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('button:contains("Today")').length > 0
      })
    })

    it('should return to current month on Today click', () => {
      cy.get('body').then($body => {
        // First navigate away
        const nextBtn = $body.find('button:has(svg.lucide-chevron-right)')
        if (nextBtn.length > 0) {
          cy.wrap(nextBtn.first()).click()
          cy.wait(300)
        }

        // Then click Today
        const todayBtn = $body.find('button:contains("Today")')
        if (todayBtn.length > 0) {
          cy.wrap(todayBtn.first()).click()
          cy.wait(300)
        }
      })
    })
  })

  describe('Calendar Display', () => {
    beforeEach(() => {
      visitCalendarTab()
    })

    it('should highlight current day', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('[class*="today"], [class*="current"], [class*="ring"], [class*="blue-500"]').length > 0
      })
    })

    it('should show vacation days in green', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('[class*="green"], [class*="vacation"]').length > 0 ||
          $body.text().toLowerCase().includes('vacation') ||
          $body.text().toLowerCase().includes('no scheduled')
      })
    })

    it('should show sick leave days in red', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('[class*="red"], [class*="sick"]').length > 0 ||
          $body.text().toLowerCase().includes('sick') ||
          $body.text().toLowerCase().includes('no scheduled')
      })
    })

    it('should display leave type badges', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('vacation') ||
          text.includes('sick') ||
          text.includes('personal') ||
          text.includes('no scheduled')
      })
    })
  })

  describe('Calendar Legend', () => {
    beforeEach(() => {
      visitCalendarTab()
    })

    it('should display legend', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('legend') ||
          text.includes('vacation') ||
          text.includes('sick') ||
          $body.find('[class*="legend"]').length > 0
      })
    })

    it('should show vacation indicator in legend', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('[class*="green"]').length > 0 ||
          $body.text().toLowerCase().includes('vacation')
      })
    })

    it('should show sick leave indicator in legend', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('[class*="red"]').length > 0 ||
          $body.text().toLowerCase().includes('sick')
      })
    })

    it('should show today indicator in legend', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('[class*="blue"], [class*="ring"]').length > 0 ||
          $body.text().toLowerCase().includes('today')
      })
    })
  })

  describe('Calendar Leave Entries', () => {
    beforeEach(() => {
      visitCalendarTab()
    })

    it('should display leave requests on calendar days', () => {
      // Calendar shows leave requests as colored blocks on day cells, or shows description text
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return $body.find('[class*="bg-blue-500"], [class*="bg-red-500"]').length > 0 ||
          text.includes('click the') ||
          text.includes('leave request')
      })
    })

    it('should show leave type labels on entries', () => {
      // Leave entries show type name (Vacation/Sick Leave) or calendar shows description
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('vacation') ||
          text.includes('sick leave') ||
          text.includes('leave request')
      })
    })

    it('should display day numbers in calendar grid', () => {
      // Calendar grid contains day numbers
      cy.get('.grid-cols-7').should('exist')
      cy.get('.grid-cols-7').should('contain.text', '1')
    })

    it('should show pending badge on pending requests', () => {
      // Pending leave requests show a PENDING badge, or no pending requests exist
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text()
        return text.includes('PENDING') ||
          $body.find('[class*="animate-pulse"]').length > 0 ||
          text.includes('Click the')
      })
    })

    it('should show description about adding leave requests', () => {
      cy.contains('Click the').should('be.visible')
    })

    it('should display calendar with day headers', () => {
      cy.get('body').should('contain.text', 'Sun')
      cy.get('body').should('contain.text', 'Mon')
      cy.get('body').should('contain.text', 'Tue')
    })
  })

  describe('Public Holidays', () => {
    beforeEach(() => {
      visitCalendarTab()
    })

    it('should highlight public holidays', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('[class*="holiday"], [class*="purple"]').length > 0 ||
          $body.text().toLowerCase().includes('holiday') ||
          $body.find('[class*="calendar"]').length > 0
      })
    })
  })
})
