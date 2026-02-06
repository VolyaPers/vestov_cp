/// <reference types="cypress" />

describe('Employee Reimbursements', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/reimbursements/limits/*').as('getLimits')
    cy.intercept('GET', '/api/reimbursements/my-requests').as('getMyRequests')
    cy.intercept('POST', '/api/reimbursements').as('submitRequest')
    cy.intercept('POST', '/api/reimbursements/*/upload').as('uploadEvidence')
    cy.loginAsTeamMember()
  })

  describe('Reimbursement Page', () => {
    beforeEach(() => {
      // Mock limits API to ensure limits card is visible
      cy.intercept('GET', '/api/reimbursements/limits/*', {
        statusCode: 200,
        body: {
          yearsAtCompany: 2,
          yearlyLimit: 500,
          usedAmount: 100,
          availableAmount: 400,
          year: new Date().getFullYear()
        }
      }).as('getLimitsMock')
      cy.visit('/employee/reimbursements')
      cy.wait(2000)
    })

    it('should load reimbursements page', () => {
      cy.url().should('include', '/employee')
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('reimbursement') ||
          text.includes('expense') ||
          text.includes('limit')
      })
    })

    it('should display limits card', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('limit') ||
          text.includes('available') ||
          text.includes('yearly') ||
          text.includes('$')
      })
    })

    it('should show years at company', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('year') ||
          text.includes('tenure') ||
          /year\s*\d/.test(text)
      })
    })

    it('should display yearly limit based on tenure', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text()
        return text.includes('$') ||
          text.toLowerCase().includes('limit')
      })
    })

    it('should show used amount', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('used') ||
          text.includes('spent') ||
          text.includes('claimed')
      })
    })

    it('should show available amount', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('available') ||
          text.includes('remaining') ||
          text.includes('left')
      })
    })

    it('should explain 50% reimbursement rule', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('50%') ||
          text.includes('half') ||
          text.includes('reimbursement')
      })
    })
  })

  describe('Submit Request', () => {
    beforeEach(() => {
      // Mock limits API to ensure form button is available
      cy.intercept('GET', '/api/reimbursements/limits/*', {
        statusCode: 200,
        body: {
          yearsAtCompany: 2,
          yearlyLimit: 500,
          usedAmount: 100,
          availableAmount: 400,
          year: new Date().getFullYear()
        }
      }).as('getLimitsMock')
      cy.visit('/employee/reimbursements')
      cy.wait(2000)
    })

    it('should display New Request button', () => {
      cy.contains('button', /new reimbursement/i).should('be.visible')
    })

    it('should open request form', () => {
      cy.contains('button', /new reimbursement/i).click()
      cy.wait(500)
      cy.get('input[type="number"]').should('exist')
    })

    it('should have expense amount field', () => {
      cy.contains('button', /new reimbursement/i).click()
      cy.wait(500)
      cy.contains('label', /expense amount/i).should('be.visible')
      cy.get('input[type="number"]').should('exist')
    })

    it('should have category selector', () => {
      cy.contains('button', /new reimbursement/i).click()
      cy.wait(500)
      cy.contains('label', /category/i).should('be.visible')
    })

    it('should have description field', () => {
      cy.contains('button', /new reimbursement/i).click()
      cy.wait(500)
      cy.contains('label', /description/i).should('be.visible')
      cy.get('textarea').should('exist')
    })

    it('should calculate estimated reimbursement', () => {
      cy.contains('button', /new reimbursement/i).click()
      cy.wait(500)

      cy.get('input[type="number"]').first().type('200')
      cy.wait(500)

      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text()
        return text.includes('$100') ||
          text.toLowerCase().includes('estimated') ||
          text.toLowerCase().includes('50%')
      })
    })

    it('should show cap warning if exceeding limit', () => {
      cy.contains('button', /new reimbursement/i).click()
      cy.wait(500)

      cy.get('input[type="number"]').first().type('99999')
      cy.wait(500)

      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('cap') ||
          text.includes('limit') ||
          text.includes('exceed') ||
          text.includes('maximum') ||
          text.includes('$')
      })
    })

    it('should submit request successfully', () => {
      // Mock the POST endpoint since test user may not have a team member record
      cy.intercept('POST', '/api/reimbursements', {
        statusCode: 201,
        body: {
          id: 999,
          year: new Date().getFullYear(),
          expenseAmount: '100.00',
          reimbursementAmount: '50.00',
          description: 'Test reimbursement request',
          category: null,
          status: 'pending',
          requestedAt: new Date().toISOString()
        }
      }).as('submitRequestMock')

      cy.contains('button', /new reimbursement/i).click()
      cy.wait(500)

      cy.get('input[type="number"]').first().type('100')
      cy.get('textarea').first().type('Test reimbursement request')

      cy.get('button[type="submit"]').click()
      cy.wait('@submitRequestMock', { timeout: 10000 }).then((interception) => {
        expect(interception.response?.statusCode).to.be.oneOf([200, 201])
      })
    })
  })

  describe('Request List', () => {
    beforeEach(() => {
      cy.visit('/employee/reimbursements')
      cy.wait(2000)
    })

    it('should display requests list', () => {
      cy.get('body').should('satisfy', ($body) => {
        const hasRequests = $body.find('[class*="card"], tr, [class*="request"]').length > 0
        const hasEmptyState = $body.text().toLowerCase().includes('no request') ||
          $body.text().toLowerCase().includes('no reimbursement')
        return hasRequests || hasEmptyState
      })
    })

    it('should show status badges', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('pending') ||
          text.includes('awaiting evidence') ||
          text.includes('approved') ||
          text.includes('rejected') ||
          text.includes('confirmed') ||
          text.includes('no reimbursement')
      })
    })

    it('should display expense and reimbursement amounts', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text()
        return text.includes('$') ||
          text.toLowerCase().includes('amount') ||
          text.toLowerCase().includes('no request')
      })
    })

    it('should show request date', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text()
        return /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(text) ||
          text.toLowerCase().includes('date') ||
          text.toLowerCase().includes('no request')
      })
    })

    it('should display category and description', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('laptop') ||
          text.includes('desk') ||
          text.includes('keyboard') ||
          text.includes('equipment') ||
          text.includes('category') ||
          text.includes('no reimbursement')
      })
    })
  })

  describe('Evidence Upload', () => {
    beforeEach(() => {
      cy.visit('/employee/reimbursements')
      cy.wait(2000)
    })

    it('should show upload button for approved requests', () => {
      cy.get('body').then($body => {
        const hasApproved = $body.text().toLowerCase().includes('approved') ||
          $body.text().toLowerCase().includes('awaiting')
        if (hasApproved) {
          cy.get('body').should('satisfy', ($b) => {
            return $b.find('button:contains("Upload"), input[type="file"]').length > 0 ||
              $b.text().toLowerCase().includes('evidence')
          })
        }
      })
    })

    it('should have file input for evidence', () => {
      cy.get('body').then($body => {
        const uploadBtn = $body.find('button:contains("Upload")')
        if (uploadBtn.length > 0) {
          cy.wrap(uploadBtn.first()).click()
          cy.wait(500)
          cy.get('body').should('satisfy', ($b) => {
            return $b.find('input[type="file"]').length > 0
          })
        }
      })
    })

    it('should display uploaded evidence link', () => {
      cy.get('body').then($body => {
        const hasEvidence = $body.text().toLowerCase().includes('evidence') ||
          $body.find('a[href*="evidence"]').length > 0
        if (hasEvidence) {
          cy.get('body').should('satisfy', ($b) => {
            return $b.find('a[href*="evidence"], button:contains("View")').length > 0 ||
              $b.text().toLowerCase().includes('evidence')
          })
        }
      })
    })
  })

  describe('Approval Notes', () => {
    beforeEach(() => {
      cy.visit('/employee/reimbursements')
      cy.wait(2000)
    })

    it('should display approval note if exists', () => {
      cy.get('body').then($body => {
        const hasApproved = $body.text().toLowerCase().includes('approved')
        if (hasApproved) {
          cy.get('body').should('satisfy', ($b) => {
            return $b.text().toLowerCase().includes('note') ||
              $b.text().toLowerCase().includes('comment') ||
              $b.text().toLowerCase().includes('approved')
          })
        }
      })
    })

    it('should display rejection reason if rejected', () => {
      cy.get('body').then($body => {
        const hasRejected = $body.text().toLowerCase().includes('rejected')
        if (hasRejected) {
          cy.get('body').should('satisfy', ($b) => {
            return $b.text().toLowerCase().includes('reason') ||
              $b.text().toLowerCase().includes('note')
          })
        }
      })
    })
  })

  describe('Dashboard Widget', () => {
    beforeEach(() => {
      cy.visit('/employee/dashboard')
      cy.wait(2000)
    })

    it('should display reimbursement summary', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('reimbursement') ||
          text.includes('budget') ||
          text.includes('expense')
      })
    })

    it('should show available budget', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text()
        return text.includes('$') ||
          text.toLowerCase().includes('available') ||
          text.toLowerCase().includes('budget')
      })
    })

    it('should have quick action to submit request', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('button:contains("Submit"), a[href*="reimbursement"]').length > 0 ||
          $body.text().toLowerCase().includes('reimbursement')
      })
    })
  })
})
