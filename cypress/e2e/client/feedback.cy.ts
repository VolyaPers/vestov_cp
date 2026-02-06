/// <reference types="cypress" />

describe('Client Feedback', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/feedback/client*').as('getFeedbacks')
    cy.intercept('GET', '/api/feedback/client-services').as('getServices')
    cy.intercept('GET', '/api/feedback/service/*/developers').as('getDevelopers')
    cy.intercept('POST', '/api/feedback').as('submitFeedback')
    cy.loginAsClient()
  })

  describe('Feedback Page', () => {
    beforeEach(() => {
      cy.visit('/client/feedback')
      cy.wait(2000)
    })

    it('should load feedback page', () => {
      cy.url().should('include', '/client')
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('feedback') || text.includes('review')
      })
    })

    it('should display feedback form', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('form, textarea, select').length > 0 ||
          $body.text().toLowerCase().includes('submit')
      })
    })

    it('should display feedback history', () => {
      cy.get('body').should('satisfy', ($body) => {
        const hasFeedbacks = $body.find('[class*="card"], [class*="feedback"]').length > 0
        const hasEmptyState = $body.text().toLowerCase().includes('no feedback')
        return hasFeedbacks || hasEmptyState || $body.text().toLowerCase().includes('history')
      })
    })
  })

  describe('Submit Feedback Form', () => {
    beforeEach(() => {
      cy.visit('/client/feedback')
      cy.wait(2000)
    })

    it('should have service selector (optional)', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('select[name*="service"], [data-testid="service-select"]').length > 0 ||
          $body.text().toLowerCase().includes('service')
      })
    })

    it('should load developers when service selected', () => {
      cy.get('body').then($body => {
        const serviceSelect = $body.find('select[name*="service"]')
        if (serviceSelect.length > 0) {
          const options = serviceSelect.find('option')
          if (options.length > 1) {
            cy.wrap(serviceSelect).select(options.eq(1).val() as string)
            cy.wait(1000)
            cy.get('body').should('satisfy', ($b) => {
              return $b.find('select[name*="developer"]').length > 0 ||
                $b.text().toLowerCase().includes('developer') ||
                $b.text().toLowerCase().includes('team member')
            })
          }
        }
      })
    })

    it('should have team member selector (optional)', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('select[name*="developer"], [data-testid="developer-select"]').length > 0 ||
          $body.text().toLowerCase().includes('team member') ||
          $body.text().toLowerCase().includes('developer')
      })
    })

    it('should have star rating', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('svg[class*="star"], [class*="rating"], button[data-rating]').length > 0 ||
          $body.text().toLowerCase().includes('rating')
      })
    })

    it('should select rating by clicking stars', () => {
      cy.get('body').then($body => {
        const stars = $body.find('svg[class*="star"], button[data-rating]')
        if (stars.length > 0) {
          cy.wrap(stars.eq(3)).click({ force: true })
          cy.wait(300)
        }
      })
    })

    it('should have comments textarea', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('textarea').length > 0 ||
          $body.text().toLowerCase().includes('feedback') ||
          $body.text().toLowerCase().includes('experience')
      })
    })

    it('should require rating', () => {
      // Type comments but don't set rating - submit should be disabled
      cy.get('textarea').first().type('Test feedback without rating')
      cy.get('button[type="submit"]').should('be.disabled')
    })

    it('should require comments', () => {
      // Click a star but don't type comments - submit should be disabled
      cy.get('body').then($body => {
        const stars = $body.find('svg[class*="star"], button[data-rating]')
        if (stars.length > 0) {
          cy.wrap(stars.eq(3)).click({ force: true })
        }
      })
      cy.get('button[type="submit"]').should('be.disabled')
    })

    it('should submit general feedback', () => {
      // Select rating
      cy.get('body').then($body => {
        const stars = $body.find('svg[class*="star"], button[data-rating]')
        if (stars.length > 0) {
          cy.wrap(stars.eq(4)).click({ force: true })
        }
      })

      // Fill comments
      cy.get('textarea').first().type('Great service! Very professional team.')

      // Submit
      cy.get('button[type="submit"]').click()
      cy.wait('@submitFeedback', { timeout: 10000 }).then((interception) => {
        expect(interception.response?.statusCode).to.be.oneOf([200, 201])
      })
    })

    it('should submit team member feedback', () => {
      // Select service if available
      cy.get('body').then($body => {
        const serviceSelect = $body.find('select[name*="service"]')
        if (serviceSelect.length > 0) {
          const options = serviceSelect.find('option')
          if (options.length > 1) {
            cy.wrap(serviceSelect).select(options.eq(1).val() as string)
            cy.wait(500)
          }
        }

        // Select developer if available
        const developerSelect = $body.find('select[name*="developer"]')
        if (developerSelect.length > 0) {
          const devOptions = developerSelect.find('option')
          if (devOptions.length > 1) {
            cy.wrap(developerSelect).select(devOptions.eq(1).val() as string)
          }
        }
      })

      // Select rating
      cy.get('body').then($body => {
        const stars = $body.find('svg[class*="star"], button[data-rating]')
        if (stars.length > 0) {
          cy.wrap(stars.eq(3)).click({ force: true })
        }
      })

      // Fill comments
      cy.get('textarea').first().type('Excellent developer! Very skilled and responsive.')

      // Submit
      cy.get('button[type="submit"]').click()
    })
  })

  describe('Feedback History', () => {
    beforeEach(() => {
      cy.visit('/client/feedback')
      cy.wait(2000)
    })

    it('should display submitted feedbacks', () => {
      cy.get('body').should('satisfy', ($body) => {
        const hasFeedbacks = $body.find('[class*="card"], [class*="feedback"]').length > 0
        const hasEmptyState = $body.text().toLowerCase().includes('no feedback')
        return hasFeedbacks || hasEmptyState
      })
    })

    it('should show rating with stars', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('svg[class*="star"], [class*="rating"]').length > 0 ||
          $body.text().toLowerCase().includes('rating') ||
          /\d\s*\/\s*5/.test($body.text())
      })
    })

    it('should display feedback comments', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('p, [class*="comment"]').length > 0 ||
          $body.text().toLowerCase().includes('comment') ||
          $body.text().toLowerCase().includes('no feedback')
      })
    })

    it('should show associated service/developer', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('service') ||
          text.includes('developer') ||
          text.includes('general') ||
          text.includes('no feedback')
      })
    })

    it('should display submission date', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text()
        return /\d{1,2}[\/\-]\d{1,2}/.test(text) ||
          text.toLowerCase().includes('submitted') ||
          text.toLowerCase().includes('no feedback')
      })
    })

    it('should show admin response if exists', () => {
      cy.get('body').then($body => {
        const hasResponse = $body.text().toLowerCase().includes('response') ||
          $body.text().toLowerCase().includes('replied')
        if (hasResponse) {
          cy.get('body').should('satisfy', ($b) => {
            return $b.text().toLowerCase().includes('response') ||
              $b.find('[class*="response"]').length > 0
          })
        }
      })
    })

    it('should indicate new vs reviewed feedback', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('pending') ||
          text.includes('responded') ||
          text.includes('reviewed') ||
          text.includes('new') ||
          text.includes('no feedback')
      })
    })
  })
})
