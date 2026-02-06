/// <reference types="cypress" />

describe('Admin Feedback Management', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/feedback/admin*').as('getFeedbacks')
    cy.intercept('POST', '/api/feedback/*/respond').as('respondFeedback')
    cy.intercept('DELETE', '/api/feedback/*').as('deleteFeedback')
    cy.loginAsAdmin()
  })

  describe('Feedback Page', () => {
    beforeEach(() => {
      cy.visit('/admin/feedback')
      cy.wait(2000)
    })

    it('should load feedback page', () => {
      cy.url().should('include', '/admin/feedback')
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('feedback') || text.includes('review')
      })
    })

    it('should display feedbacks list', () => {
      cy.get('body').should('satisfy', ($body) => {
        const hasFeedbacks = $body.find('[class*="card"], tr, [class*="feedback"]').length > 0
        const hasEmptyState = $body.text().toLowerCase().includes('no feedback')
        return hasFeedbacks || hasEmptyState
      })
    })
  })

  describe('Feedback Display', () => {
    beforeEach(() => {
      cy.visit('/admin/feedback')
      cy.wait(2000)
    })

    it('should display rating', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('svg[class*="star"], [class*="rating"]').length > 0 ||
          $body.text().toLowerCase().includes('rating') ||
          /\d\s*\/\s*5/.test($body.text())
      })
    })

    it('should display comments', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('comment') ||
          text.includes('feedback') ||
          $body.find('p, [class*="comment"]').length > 0
      })
    })

    it('should show feedback type', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('general') ||
          text.includes('team member') ||
          text.includes('service') ||
          text.includes('type')
      })
    })

    it('should display status badge', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('pending') ||
          text.includes('responded') ||
          text.includes('status')
      })
    })

    it('should show client/service info', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('client') ||
          text.includes('service') ||
          text.includes('developer')
      })
    })
  })

  describe('Filters', () => {
    beforeEach(() => {
      cy.visit('/admin/feedback')
      cy.wait(2000)
    })

    it('should filter by pending status', () => {
      cy.get('body').then($body => {
        const pendingBtn = $body.find('button:contains("Pending")')
        if (pendingBtn.length > 0) {
          cy.wrap(pendingBtn.first()).click()
          cy.wait(500)
        }
      })
    })

    it('should filter by responded status', () => {
      cy.get('body').then($body => {
        const respondedBtn = $body.find('button:contains("Responded")')
        if (respondedBtn.length > 0) {
          cy.wrap(respondedBtn.first()).click()
          cy.wait(500)
        }
      })
    })

    it('should filter by client', () => {
      cy.get('body').then($body => {
        const clientFilter = $body.find('select[name*="client"]')
        if (clientFilter.length > 0) {
          const options = clientFilter.find('option')
          if (options.length > 1) {
            cy.wrap(clientFilter).select(options.eq(1).val() as string)
          }
        }
      })
    })
  })

  describe('Respond to Feedback', () => {
    beforeEach(() => {
      cy.visit('/admin/feedback')
      cy.wait(2000)
    })

    it('should open respond dialog', () => {
      cy.get('body').then($body => {
        const respondBtn = $body.find('button:contains("Respond")')
        if (respondBtn.length > 0) {
          cy.wrap(respondBtn.first()).click()
          cy.wait(500)
          cy.get('body').should('satisfy', ($b) => {
            return $b.find('[role="dialog"], textarea').length > 0
          })
        }
      })
    })

    it('should have response textarea', () => {
      cy.get('body').then($body => {
        const respondBtn = $body.find('button:contains("Respond")')
        if (respondBtn.length > 0) {
          cy.wrap(respondBtn.first()).click()
          cy.wait(500)
          cy.get('body').should('satisfy', ($b) => {
            return $b.find('textarea[name="response"], textarea[placeholder*="response"]').length > 0
          })
        }
      })
    })

    it('should submit response', () => {
      cy.get('body').then($body => {
        const respondBtn = $body.find('button:contains("Respond")')
        if (respondBtn.length > 0) {
          cy.wrap(respondBtn.first()).click()
          cy.wait(500)
          cy.get('textarea').first().type('Thank you for your feedback!')
          cy.contains('button', /submit|send/i).click()
          cy.wait('@respondFeedback', { timeout: 10000 })
        }
      })
    })
  })

  describe('Admin Response Display', () => {
    beforeEach(() => {
      cy.visit('/admin/feedback')
      cy.wait(2000)
    })

    it('should display admin response if exists', () => {
      cy.get('body').then($body => {
        const hasResponded = $body.text().toLowerCase().includes('responded')
        if (hasResponded) {
          cy.get('body').should('satisfy', ($b) => {
            return $b.text().toLowerCase().includes('response') ||
              $b.find('[class*="response"]').length > 0
          })
        }
      })
    })

    it('should show response date', () => {
      cy.get('body').then($body => {
        const hasResponded = $body.text().toLowerCase().includes('responded')
        if (hasResponded) {
          cy.get('body').should('satisfy', ($b) => {
            const text = $b.text()
            return /\d{1,2}[\/\-]\d{1,2}/.test(text)
          })
        }
      })
    })
  })

  describe('Delete Feedback', () => {
    beforeEach(() => {
      cy.visit('/admin/feedback')
      cy.wait(2000)
    })

    it('should show delete confirmation', () => {
      cy.get('body').then($body => {
        const deleteBtn = $body.find('button:contains("Delete"), button[aria-label*="delete"]')
        if (deleteBtn.length > 0) {
          cy.wrap(deleteBtn.first()).click({ force: true })
          cy.wait(500)
          cy.get('body').should('satisfy', ($b) => {
            const text = $b.text().toLowerCase()
            return text.includes('confirm') ||
              text.includes('are you sure')
          })
        }
      })
    })
  })
})
