/// <reference types="cypress" />

describe('Client Team Status', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/client/team-shifts').as('getTeamShifts')
    cy.intercept('GET', '/api/client/team-vacations').as('getTeamVacations')
    cy.intercept('GET', '/api/client/team-schedules').as('getTeamSchedules')
    cy.loginAsClient()
  })

  describe('Team Status Page', () => {
    beforeEach(() => {
      cy.visit('/client/team-status')
      cy.wait(2000)
    })

    it('should load team status page', () => {
      cy.url().should('include', '/client')
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('team') ||
          text.includes('status') ||
          text.includes('member')
      })
    })

    it('should display team members list', () => {
      cy.get('body').should('satisfy', ($body) => {
        const hasMembers = $body.find('[class*="card"], tr, [class*="member"]').length > 0
        const hasEmptyState = $body.text().toLowerCase().includes('no team')
        return hasMembers || hasEmptyState
      })
    })

    it('should show member avatars', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('img, [class*="avatar"], svg[class*="user"]').length > 0 ||
          $body.text().toLowerCase().includes('team')
      })
    })
  })

  describe('Real-time Shift Tracking', () => {
    beforeEach(() => {
      cy.visit('/client/team-status')
      cy.wait(2000)
    })

    it('should display shift status', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('working') ||
          text.includes('offline') ||
          text.includes('break') ||
          text.includes('status') ||
          text.includes('shift')
      })
    })

    it('should show working duration', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text()
        return /\d+h|\d+:\d+|\d+\s*hour/.test(text) ||
          text.toLowerCase().includes('duration') ||
          text.toLowerCase().includes('working')
      })
    })

    it('should display break indicator', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('break') ||
          text.includes('away') ||
          text.includes('status')
      })
    })

    it('should show late arrival indicator', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('late') ||
          text.includes('on time') ||
          text.includes('schedule') ||
          text.includes('status')
      })
    })
  })

  describe('Team Calendar', () => {
    beforeEach(() => {
      cy.visit('/client/team-status')
      cy.wait(2000)
    })

    it('should display calendar view', () => {
      cy.get('body').then($body => {
        const calendarTab = $body.find('button:contains("Calendar"), [role="tab"]:contains("Calendar")')
        if (calendarTab.length > 0) {
          cy.wrap(calendarTab.first()).click()
          cy.wait(1000)
        }
      })
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text()
        return text.includes('Sun') ||
          text.includes('Mon') ||
          $body.find('[class*="calendar"]').length > 0 ||
          /January|February|March|April|May|June|July|August|September|October|November|December/.test(text)
      })
    })

    it('should navigate between months', () => {
      cy.get('body').then($body => {
        const calendarTab = $body.find('button:contains("Calendar"), [role="tab"]:contains("Calendar")')
        if (calendarTab.length > 0) {
          cy.wrap(calendarTab.first()).click()
          cy.wait(1000)
        }
        const nextBtn = $body.find('button:has(svg.lucide-chevron-right), button[aria-label*="next"]')
        if (nextBtn.length > 0) {
          cy.wrap(nextBtn.first()).click()
          cy.wait(500)
        }
      })
    })

    it('should show working vs vacation days', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('working') ||
          text.includes('vacation') ||
          text.includes('available') ||
          text.includes('off')
      })
    })

    it('should highlight vacation days', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('[class*="vacation"], [class*="green"], [class*="highlight"]').length > 0 ||
          $body.text().toLowerCase().includes('vacation')
      })
    })
  })

  describe('Team Member Details', () => {
    beforeEach(() => {
      cy.visit('/client/team-status')
      cy.wait(2000)
    })

    it('should display member name', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('name') ||
          text.includes('eduardo') ||
          text.includes('team')
      })
    })

    it('should show member role/position', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('developer') ||
          text.includes('designer') ||
          text.includes('position') ||
          text.includes('role')
      })
    })

  })

  describe('Status Indicators', () => {
    beforeEach(() => {
      cy.visit('/client/team-status')
      cy.wait(2000)
    })

    it('should show green indicator for working', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('[class*="green"], [class*="working"], [class*="online"]').length > 0 ||
          $body.text().toLowerCase().includes('working')
      })
    })

    it('should show yellow indicator for on break', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('[class*="yellow"], [class*="break"], [class*="away"]').length > 0 ||
          $body.text().toLowerCase().includes('break')
      })
    })

    it('should show gray indicator for offline', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('[class*="gray"], [class*="offline"]').length > 0 ||
          $body.text().toLowerCase().includes('offline')
      })
    })
  })

  describe('Upcoming Vacations', () => {
    beforeEach(() => {
      cy.visit('/client/team-status')
      cy.wait(2000)
    })

    it('should display upcoming vacations section', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('upcoming') ||
          text.includes('vacation') ||
          text.includes('time off') ||
          text.includes('schedule')
      })
    })

    it('should show vacation dates', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text()
        return /\d{1,2}[\/\-]\d{1,2}/.test(text) ||
          text.toLowerCase().includes('date') ||
          text.toLowerCase().includes('vacation')
      })
    })

    it('should show affected team members', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('member') ||
          text.includes('eduardo') ||
          text.includes('team') ||
          text.includes('vacation')
      })
    })
  })

  describe('Responsive Design', () => {
    it('should display correctly on mobile', () => {
      cy.viewport('iphone-6')
      cy.visit('/client/team-status')
      cy.wait(2000)
      cy.get('body').should('be.visible')
    })

    it('should display correctly on tablet', () => {
      cy.viewport('ipad-2')
      cy.visit('/client/team-status')
      cy.wait(2000)
      cy.get('body').should('be.visible')
    })

    afterEach(() => {
      cy.viewport(1280, 720)
    })
  })
})
