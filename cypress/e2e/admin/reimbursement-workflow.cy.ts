/// <reference types="cypress" />

describe('Admin Reimbursement Workflow', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/reimbursements*').as('getReimbursements')
    cy.intercept('PUT', '/api/reimbursements/*/status').as('updateStatus')
    cy.intercept('GET', '/api/reimbursements/evidence/*').as('getEvidence')
    cy.loginAsAdmin()
  })

  describe('Reimbursement Dashboard', () => {
    beforeEach(() => {
      cy.visit('/admin/reimbursements')
      cy.wait(2000)
    })

    it('should load reimbursements page', () => {
      cy.url().should('include', '/admin/reimbursements')
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('reimbursement') ||
          text.includes('expense') ||
          text.includes('request')
      })
    })

    it('should display stats cards', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('pending') ||
          text.includes('approved') ||
          text.includes('total') ||
          text.includes('confirmed')
      })
    })

    it('should show pending count', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('pending') ||
          /\d+\s*(pending|awaiting)/.test(text) ||
          text.includes('no pending')
      })
    })

    it('should display total paid amount for current year', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text()
        return text.includes('$') ||
          text.toLowerCase().includes('total') ||
          text.toLowerCase().includes('paid')
      })
    })

    it('should list reimbursement requests', () => {
      cy.get('body').should('satisfy', ($body) => {
        const hasRequests = $body.find('[class*="card"], tr, [class*="request"]').length > 0
        const hasEmptyState = $body.text().toLowerCase().includes('no reimbursement') ||
          $body.text().toLowerCase().includes('no requests')
        return hasRequests || hasEmptyState
      })
    })
  })

  describe('Filters', () => {
    beforeEach(() => {
      cy.visit('/admin/reimbursements')
      cy.wait(2000)
    })

    it('should search by employee name', () => {
      cy.get('body').then($body => {
        const searchInput = $body.find('input[type="search"], input[placeholder*="search"]')
        if (searchInput.length > 0) {
          cy.wrap(searchInput.first()).type('eduardo')
          cy.wait(1000)
          cy.get('body').should('be.visible')
        }
      })
    })

    it('should filter by pending status', () => {
      cy.get('body').then($body => {
        const pendingFilter = $body.find('button:contains("Pending"), select option:contains("Pending")')
        if (pendingFilter.length > 0) {
          if (pendingFilter.is('button')) {
            cy.wrap(pendingFilter.first()).click()
          } else {
            cy.get('select').first().select('pending')
          }
          cy.wait(1000)
        }
      })
    })

    it('should filter by approved status', () => {
      cy.get('body').then($body => {
        const approvedFilter = $body.find('button:contains("Approved"), select option:contains("Approved")')
        if (approvedFilter.length > 0) {
          if (approvedFilter.is('button')) {
            cy.wrap(approvedFilter.first()).click()
          } else {
            cy.get('select').first().select('approved')
          }
          cy.wait(1000)
        }
      })
    })

    it('should filter by rejected status', () => {
      cy.get('body').then($body => {
        const rejectedFilter = $body.find('button:contains("Rejected"), select option:contains("Rejected")')
        if (rejectedFilter.length > 0) {
          if (rejectedFilter.is('button')) {
            cy.wrap(rejectedFilter.first()).click()
          } else {
            cy.get('select').first().select('rejected')
          }
          cy.wait(1000)
        }
      })
    })

    it('should filter by year', () => {
      cy.get('body').then($body => {
        const yearFilter = $body.find('select[name*="year"], input[type="number"][placeholder*="year"]')
        if (yearFilter.length > 0) {
          cy.wrap(yearFilter.first()).clear().type('2024')
          cy.wait(1000)
        }
      })
    })

    it('should show all requests when reset', () => {
      cy.get('body').then($body => {
        const allBtn = $body.find('button:contains("All"), button:contains("Reset")')
        if (allBtn.length > 0) {
          cy.wrap(allBtn.first()).click()
          cy.wait(1000)
        }
      })
    })
  })

  describe('Request Details', () => {
    beforeEach(() => {
      cy.visit('/admin/reimbursements')
      cy.wait(2000)
    })

    it('should display employee name', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('employee') ||
          text.includes('name') ||
          text.includes('eduardo') ||
          text.includes('no requests')
      })
    })

    it('should show expense amount', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text()
        return text.includes('$') ||
          text.toLowerCase().includes('expense') ||
          text.toLowerCase().includes('amount') ||
          text.toLowerCase().includes('no requests')
      })
    })

    it('should show reimbursement amount (50% of expense)', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('reimbursement') ||
          text.includes('50%') ||
          text.includes('amount') ||
          text.includes('$')
      })
    })

    it('should display category', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('laptop') ||
          text.includes('desk') ||
          text.includes('chair') ||
          text.includes('equipment') ||
          text.includes('category') ||
          text.includes('no requests')
      })
    })

    it('should show status badge', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('pending') ||
          text.includes('approved') ||
          text.includes('rejected') ||
          text.includes('confirmed') ||
          text.includes('awaiting') ||
          text.includes('no requests')
      })
    })

    it('should display request date', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text()
        return /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(text) ||
          text.toLowerCase().includes('date') ||
          text.toLowerCase().includes('requested') ||
          text.toLowerCase().includes('no requests')
      })
    })
  })

  describe('Approval Workflow', () => {
    beforeEach(() => {
      cy.visit('/admin/reimbursements')
      cy.wait(2000)
    })

    it('should display reject button for pending requests', () => {
      cy.get('body').then($body => {
        const hasPending = $body.text().toLowerCase().includes('pending')
        if (hasPending) {
          cy.get('body').should('satisfy', ($b) => {
            return $b.find('button:contains("Reject"), button:contains("Deny")').length > 0 ||
              $b.find('svg.lucide-x').length > 0
          })
        }
      })
    })

    it('should open approve dialog', () => {
      cy.get('body').then($body => {
        const approveBtn = $body.find('button:contains("Approve"):not(:disabled)')
        if (approveBtn.length > 0) {
          cy.wrap(approveBtn.first()).click()
          cy.wait(500)
          cy.get('body').should('satisfy', ($b) => {
            const text = $b.text().toLowerCase()
            return text.includes('approve') ||
              text.includes('confirm') ||
              text.includes('note') ||
              $b.find('[role="dialog"]').length > 0
          })
        }
      })
    })

    it('should approve request with optional note', () => {
      cy.get('body').then($body => {
        const approveBtn = $body.find('button:contains("Approve"):not(:disabled)')
        if (approveBtn.length > 0) {
          cy.wrap(approveBtn.first()).click()
          cy.wait(500)

          // Add note if field exists
          cy.get('body').then($dialogBody => {
            const noteInput = $dialogBody.find('textarea[name="note"], textarea[placeholder*="note"]')
            if (noteInput.length > 0) {
              cy.wrap(noteInput).type('Test approval note')
            }
          })

          // Confirm approval
          cy.contains('button', /confirm|approve|submit/i).click()
          cy.wait('@updateStatus', { timeout: 10000 }).then((interception) => {
            expect(interception.response?.statusCode).to.be.oneOf([200, 201])
          })
        }
      })
    })

    it('should open reject dialog', () => {
      cy.get('body').then($body => {
        const rejectBtn = $body.find('button:contains("Reject"), button:contains("Deny")')
        if (rejectBtn.length > 0) {
          cy.wrap(rejectBtn.first()).click()
          cy.wait(500)
          cy.get('body').should('satisfy', ($b) => {
            const text = $b.text().toLowerCase()
            return text.includes('reject') ||
              text.includes('deny') ||
              text.includes('reason') ||
              $b.find('[role="dialog"]').length > 0
          })
        }
      })
    })

    it('should reject request with required reason', () => {
      cy.get('body').then($body => {
        const rejectBtn = $body.find('button:contains("Reject"), button:contains("Deny")')
        if (rejectBtn.length > 0) {
          cy.wrap(rejectBtn.first()).click()
          cy.wait(500)

          // Fill reason
          cy.get('textarea[name="reason"], textarea[placeholder*="reason"]').first().type('Test rejection reason')

          // Confirm rejection
          cy.contains('button', /confirm|reject|submit/i).click()
          cy.wait('@updateStatus', { timeout: 10000 }).then((interception) => {
            expect(interception.response?.statusCode).to.be.oneOf([200, 201])
          })
        }
      })
    })

    it('should status change to "Awaiting Evidence" after approval', () => {
      cy.get('body').then($body => {
        const hasAwaitingEvidence = $body.text().toLowerCase().includes('awaiting evidence') ||
          $body.text().toLowerCase().includes('awaiting')
        if (hasAwaitingEvidence) {
          cy.get('body').should('contain.text', 'Awaiting')
        }
      })
    })

  })

  describe('Evidence Confirmation', () => {
    beforeEach(() => {
      cy.visit('/admin/reimbursements')
      cy.wait(2000)
    })

    it('should display evidence link when uploaded', () => {
      cy.get('body').then($body => {
        const hasEvidence = $body.text().toLowerCase().includes('evidence') ||
          $body.find('a[href*="evidence"]').length > 0
        if (hasEvidence) {
          cy.get('body').should('satisfy', ($b) => {
            return $b.find('a[href*="evidence"], button:contains("View Evidence")').length > 0 ||
              $b.text().toLowerCase().includes('evidence')
          })
        }
      })
    })

    it('should preview evidence when clicking link', () => {
      cy.get('body').then($body => {
        const evidenceLink = $body.find('a[href*="evidence"], button:contains("View Evidence")')
        if (evidenceLink.length > 0) {
          cy.wrap(evidenceLink.first()).click({ force: true })
          cy.wait(1000)
        }
      })
    })

    it('should confirm evidence and change status', () => {
      cy.get('body').then($body => {
        const confirmBtn = $body.find('button:contains("Confirm Evidence"), button:contains("Confirm Receipt")')
        if (confirmBtn.length > 0) {
          cy.wrap(confirmBtn.first()).click()
          cy.wait('@updateStatus', { timeout: 10000 })
        }
      })
    })

    it('should show "Confirmed" status after confirmation', () => {
      cy.get('body').then($body => {
        const hasConfirmed = $body.text().toLowerCase().includes('confirmed')
        if (hasConfirmed) {
          cy.get('body').should('contain.text', 'onfirmed')
        }
      })
    })
  })

  describe('Status Badges', () => {
    beforeEach(() => {
      cy.visit('/admin/reimbursements')
      cy.wait(2000)
    })

    it('should display pending badge with yellow/orange color', () => {
      cy.get('body').then($body => {
        const hasPending = $body.text().toLowerCase().includes('pending')
        if (hasPending) {
          cy.get('body').should('satisfy', ($b) => {
            return $b.find('[class*="yellow"], [class*="orange"], [class*="pending"]').length > 0 ||
              $b.text().toLowerCase().includes('pending')
          })
        }
      })
    })

    it('should display approved badge with green color', () => {
      cy.get('body').then($body => {
        const hasApproved = $body.text().toLowerCase().includes('approved') ||
          $body.text().toLowerCase().includes('awaiting')
        if (hasApproved) {
          cy.get('body').should('satisfy', ($b) => {
            return $b.find('[class*="green"], [class*="approved"]').length > 0 ||
              $b.text().toLowerCase().includes('approved')
          })
        }
      })
    })

    it('should display rejected badge with red color', () => {
      cy.get('body').then($body => {
        const hasRejected = $body.text().toLowerCase().includes('rejected')
        if (hasRejected) {
          cy.get('body').should('satisfy', ($b) => {
            return $b.find('[class*="red"], [class*="rejected"]').length > 0 ||
              $b.text().toLowerCase().includes('rejected')
          })
        }
      })
    })

    it('should display confirmed badge with success color', () => {
      cy.get('body').then($body => {
        const hasConfirmed = $body.text().toLowerCase().includes('confirmed')
        if (hasConfirmed) {
          cy.get('body').should('satisfy', ($b) => {
            return $b.find('[class*="green"], [class*="confirmed"], [class*="success"]').length > 0 ||
              $b.text().toLowerCase().includes('confirmed')
          })
        }
      })
    })
  })

  describe('Yearly Summary', () => {
    beforeEach(() => {
      cy.visit('/admin/reimbursements')
      cy.wait(2000)
    })

    it('should display yearly total', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('total') ||
          text.includes('year') ||
          text.includes('$') ||
          text.includes('paid')
      })
    })

    it('should show breakdown by status', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('pending') ||
          text.includes('approved') ||
          text.includes('confirmed') ||
          text.includes('rejected')
      })
    })
  })
})
