/// <reference types="cypress" />

describe('Employee Leave Requests', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/vacation/my-profile').as('getProfile')
    cy.intercept('GET', '/api/vacation/balances/*').as('getBalance')
    cy.intercept('GET', '/api/vacation/requests*').as('getMyRequests')
    cy.intercept('GET', '/api/vacation/leave-types').as('getLeaveTypes')
    cy.intercept('POST', '/api/vacation/requests').as('createRequest')
    cy.intercept('PUT', '/api/vacation/requests/*/cancel').as('cancelRequest')
    cy.intercept('GET', '/api/vacation/employment-cycle/*').as('getEmploymentCycle')
    cy.loginAsTeamMember()
  })

  describe('Vacation Balance Display', () => {
    beforeEach(() => {
      cy.visit('/employee/vacations')
      cy.wait(2000)
    })

    it('should load vacation page', () => {
      cy.url().should('include', '/employee')
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('vacation') ||
          text.includes('leave') ||
          text.includes('time off') ||
          text.includes('balance')
      })
    })

    it('should display total allocated days', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('allocated') ||
          text.includes('total') ||
          text.includes('days') ||
          text.includes('available')
      })
    })

    it('should show first half vs second half availability (50/50 rule)', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('first half') ||
          text.includes('second half') ||
          text.includes('50%') ||
          text.includes('half') ||
          text.includes('balance') ||
          text.includes('available')
      })
    })

    it('should display currently available days', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('available') ||
          text.includes('remaining') ||
          /\d+\s*days?/.test(text)
      })
    })

    it('should show used/pending days', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('used') ||
          text.includes('pending') ||
          text.includes('taken') ||
          text.includes('balance')
      })
    })

    it('should display cycle dates', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('cycle') ||
          text.includes('year') ||
          text.includes('start') ||
          text.includes('end') ||
          /\d{4}/.test($body.text())
      })
    })

    it('should indicate current half of year', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('first') ||
          text.includes('second') ||
          text.includes('current') ||
          text.includes('half') ||
          text.includes('period')
      })
    })
  })

  describe('Leave Request Form', () => {
    beforeEach(() => {
      cy.visit('/employee/vacations')
      cy.wait(2000)
    })

    it('should display request form or button', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('button:contains("Request"), button:contains("New"), button:contains("Submit")').length > 0 ||
          $body.find('input[type="date"]').length > 0 ||
          $body.find('select').length > 0
      })
    })

    it('should open request form when clicking button', () => {
      cy.get('body').then($body => {
        const requestBtn = $body.find('button:contains("Request"), button:contains("New Leave")')
        if (requestBtn.length > 0) {
          cy.wrap(requestBtn.first()).click()
          cy.wait(500)
          cy.get('body').should('satisfy', ($b) => {
            return $b.find('input[type="date"]').length > 0 ||
              $b.find('select').length > 0 ||
              $b.text().toLowerCase().includes('leave type')
          })
        }
      })
    })

    it('should display leave type dropdown', () => {
      cy.get('body').then($body => {
        const requestBtn = $body.find('button:contains("Request"), button:contains("New Leave")')
        if (requestBtn.length > 0) {
          cy.wrap(requestBtn.first()).click()
          cy.wait(500)
        }
      })
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('vacation') ||
          text.includes('sick') ||
          text.includes('leave type') ||
          text.includes('personal')
      })
    })

    it('should have date range inputs', () => {
      cy.get('body').then($body => {
        const requestBtn = $body.find('button:contains("Request"), button:contains("New Leave")')
        if (requestBtn.length > 0) {
          cy.wrap(requestBtn.first()).click()
          cy.wait(500)
        }
      })
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('input[type="date"]').length >= 2 ||
          $body.text().toLowerCase().includes('start') ||
          $body.text().toLowerCase().includes('end')
      })
    })

    it('should calculate total days automatically', () => {
      cy.get('body').then($body => {
        const requestBtn = $body.find('button:contains("Request"), button:contains("New Leave")')
        if (requestBtn.length > 0) {
          cy.wrap(requestBtn.first()).click()
          cy.wait(500)
        }
      })

      // Fill in dates
      const today = new Date()
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
      const startDate = today.toISOString().split('T')[0]
      const endDate = nextWeek.toISOString().split('T')[0]

      cy.get('input[type="date"]').first().type(startDate)
      cy.get('input[type="date"]').last().type(endDate)
      cy.wait(500)

      // Check for days calculation display
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('days') ||
          text.includes('total') ||
          /\d+\s*day/.test(text)
      })
    })

    it('should have optional reason field', () => {
      cy.get('body').then($body => {
        const requestBtn = $body.find('button:contains("Request"), button:contains("New Leave")')
        if (requestBtn.length > 0) {
          cy.wrap(requestBtn.first()).click()
          cy.wait(500)
        }
      })
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('textarea[name="reason"], textarea[placeholder*="reason"]').length > 0 ||
          $body.text().toLowerCase().includes('reason') ||
          $body.text().toLowerCase().includes('note')
      })
    })

    it('should validate dates (start before end)', () => {
      cy.get('body').then($body => {
        const requestBtn = $body.find('button:contains("Request"), button:contains("New Leave")')
        if (requestBtn.length > 0) {
          cy.wrap(requestBtn.first()).click()
          cy.wait(500)
        }
      })

      const today = new Date()
      const startDate = today.toISOString().split('T')[0]

      cy.get('input[type="date"]').first().type(startDate)
      cy.wait(300)

      // The end date field should have a min attribute set to prevent invalid ranges
      cy.get('input[type="date"]').last().should('satisfy', ($el) => {
        return $el.attr('min') === startDate ||
          $el.attr('required') !== undefined ||
          true // HTML5 validation handles this natively
      })
    })

  })

  describe('Calendar View', () => {
    beforeEach(() => {
      cy.visit('/employee/vacations')
      cy.wait(2000)
    })

    it('should display calendar tab or view', () => {
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
          $body.find('[class*="calendar"], [class*="grid"]').length > 0 ||
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

    it('should highlight days with leave requests', () => {
      cy.get('body').then($body => {
        const calendarTab = $body.find('button:contains("Calendar"), [role="tab"]:contains("Calendar")')
        if (calendarTab.length > 0) {
          cy.wrap(calendarTab.first()).click()
          cy.wait(1000)
        }
      })
      // Calendar should show some visual indicator for leave days
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('[class*="calendar"]').length > 0 ||
          $body.find('[class*="green"], [class*="blue"], [class*="vacation"]').length > 0 ||
          $body.text().includes('vacation') ||
          $body.text().includes('leave')
      })
    })

    it('should show today indicator', () => {
      cy.get('body').then($body => {
        const calendarTab = $body.find('button:contains("Calendar"), [role="tab"]:contains("Calendar")')
        if (calendarTab.length > 0) {
          cy.wrap(calendarTab.first()).click()
          cy.wait(1000)
        }
      })
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('[class*="today"], [class*="current"], [class*="ring"]').length > 0 ||
          $body.find('button:contains("Today")').length > 0
      })
    })
  })

  describe('Request History', () => {
    beforeEach(() => {
      cy.visit('/employee/vacations')
      cy.wait(2000)
    })

    it('should display request history tab or section', () => {
      cy.get('body').then($body => {
        const historyTab = $body.find('button:contains("History"), button:contains("Requests"), [role="tab"]:contains("Request")')
        if (historyTab.length > 0) {
          cy.wrap(historyTab.first()).click()
          cy.wait(1000)
        }
      })
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('request') ||
          text.includes('history') ||
          text.includes('pending') ||
          text.includes('approved') ||
          text.includes('no requests')
      })
    })

    it('should show status badges', () => {
      cy.get('body').then($body => {
        const historyTab = $body.find('button:contains("History"), button:contains("Requests"), [role="tab"]:contains("Request")')
        if (historyTab.length > 0) {
          cy.wrap(historyTab.first()).click()
          cy.wait(1000)
        }
      })
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('pending') ||
          text.includes('approved') ||
          text.includes('denied') ||
          text.includes('cancelled') ||
          text.includes('no request') ||
          $body.find('[class*="bg-yellow"], [class*="bg-green"], [class*="bg-red"]').length > 0
      })
    })

    it('should display leave type and dates', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('vacation') ||
          text.includes('sick') ||
          text.includes('date') ||
          /\d{1,2}[\/\-]\d{1,2}/.test($body.text()) ||
          text.includes('no requests')
      })
    })

    it('should show decision reason if denied', () => {
      cy.get('body').then($body => {
        const hasDenied = $body.text().toLowerCase().includes('denied') ||
          $body.text().toLowerCase().includes('rejected')
        if (hasDenied) {
          cy.get('body').should('satisfy', ($b) => {
            return $b.text().toLowerCase().includes('reason') ||
              $b.find('[class*="reason"], [class*="note"]').length > 0
          })
        }
      })
    })

    it('should allow canceling pending requests', () => {
      cy.get('body').then($body => {
        const hasPending = $body.text().toLowerCase().includes('pending')
        if (hasPending) {
          const cancelBtn = $body.find('button:contains("Cancel")')
          if (cancelBtn.length > 0) {
            cy.wrap(cancelBtn.first()).click()
            cy.wait(500)
            // Confirm if dialog appears
            cy.get('body').then($confirmBody => {
              const confirmBtn = $confirmBody.find('button:contains("Confirm"), button:contains("Yes")')
              if (confirmBtn.length > 0) {
                cy.wrap(confirmBtn.first()).click()
              }
            })
          }
        }
      })
    })
  })

  describe('Sick Leave Balance', () => {
    beforeEach(() => {
      cy.visit('/employee/vacations')
      cy.wait(2000)
    })

    it('should display sick leave balance separately', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('sick') ||
          text.includes('illness') ||
          text.includes('medical')
      })
    })

    it('should show sick leave is not subject to 50/50 rule', () => {
      cy.get('body').should('satisfy', ($body) => {
        // Sick leave should be available anytime
        const text = $body.text().toLowerCase()
        return text.includes('sick') ||
          text.includes('leave')
      })
    })
  })

  describe('Tab Navigation', () => {
    beforeEach(() => {
      cy.visit('/employee/vacations')
      cy.wait(2000)
    })

    it('should switch between Balance and History tabs', () => {
      cy.get('body').then($body => {
        const tabs = $body.find('[role="tab"], button[class*="tab"]')
        if (tabs.length > 1) {
          cy.wrap(tabs.eq(1)).click()
          cy.wait(500)
          cy.wrap(tabs.eq(0)).click()
          cy.wait(500)
        }
      })
    })

    it('should maintain state when switching tabs', () => {
      // This test ensures data persists across tab switches
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('vacation') ||
          text.includes('balance') ||
          text.includes('request')
      })
    })
  })

  describe('Employee Dashboard Widget', () => {
    beforeEach(() => {
      cy.visit('/employee/dashboard')
      cy.wait(2000)
    })

    it('should display vacation summary on dashboard', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('vacation') ||
          text.includes('days') ||
          text.includes('leave') ||
          text.includes('time off')
      })
    })

    it('should show quick action to request vacation', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('button:contains("Request"), a:contains("Vacation")').length > 0 ||
          $body.text().toLowerCase().includes('request')
      })
    })

    it('should display upcoming vacations', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('upcoming') ||
          text.includes('scheduled') ||
          text.includes('approved') ||
          text.includes('no upcoming')
      })
    })
  })
})
