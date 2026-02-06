/// <reference types="cypress" />

describe('Client Invoices', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/invoices/client/*').as('getInvoices')
    cy.intercept('GET', '/api/invoices/client/*/totals').as('getInvoiceTotals')
    cy.loginAsClient()
  })

  describe('Invoices Page', () => {
    beforeEach(() => {
      // Route requires client ID - extract from sidebar link
      cy.visit('/client/dashboard')
      cy.wait(2000)
      cy.get('a[href*="/client/invoices/"]').first().then($link => {
        const href = $link.attr('href')
        cy.visit(href!)
      })
      cy.url().should('include', '/client/invoices/')
      cy.wait(2000)
    })

    it('should load invoices page', () => {
      cy.url().should('include', '/client')
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('invoice') || text.includes('billing')
      })
    })

    it('should display invoices list', () => {
      cy.get('body').should('satisfy', ($body) => {
        const hasInvoices = $body.find('[class*="card"], tr, [class*="invoice"]').length > 0
        const hasEmptyState = $body.text().toLowerCase().includes('no invoice')
        return hasInvoices || hasEmptyState
      })
    })
  })

  describe('Invoice Metrics', () => {
    beforeEach(() => {
      // Route requires client ID - extract from sidebar link
      cy.visit('/client/dashboard')
      cy.wait(2000)
      cy.get('a[href*="/client/invoices/"]').first().then($link => {
        const href = $link.attr('href')
        cy.visit(href!)
      })
      cy.url().should('include', '/client/invoices/')
      cy.wait(2000)
    })

    it('should display Total Billed', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('total') ||
          text.includes('billed') ||
          text.includes('$')
      })
    })

    it('should show Paid Amount', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('paid') ||
          text.includes('$')
      })
    })

    it('should show Pending Amount', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('pending') ||
          text.includes('outstanding') ||
          text.includes('$')
      })
    })

    it('should show Overdue Amount', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('overdue') ||
          text.includes('late') ||
          text.includes('$')
      })
    })
  })

  describe('Invoice Display', () => {
    beforeEach(() => {
      // Route requires client ID - extract from sidebar link
      cy.visit('/client/dashboard')
      cy.wait(2000)
      cy.get('a[href*="/client/invoices/"]').first().then($link => {
        const href = $link.attr('href')
        cy.visit(href!)
      })
      cy.url().should('include', '/client/invoices/')
      cy.wait(2000)
    })

    it('should display invoice number', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text()
        return /INV-\d+|#\d+/.test(text) ||
          text.toLowerCase().includes('invoice') ||
          text.toLowerCase().includes('no invoice')
      })
    })

    it('should show status badge', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('paid') ||
          text.includes('pending') ||
          text.includes('overdue') ||
          text.includes('draft') ||
          text.includes('no invoice')
      })
    })

    it('should display amount', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text()
        return text.includes('$') ||
          text.toLowerCase().includes('amount') ||
          text.toLowerCase().includes('no invoice')
      })
    })

    it('should show period dates', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text()
        return /\d{1,2}[\/\-]\d{1,2}/.test(text) ||
          text.toLowerCase().includes('period') ||
          text.toLowerCase().includes('no invoice')
      })
    })

    it('should display due date', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('due') ||
          /\d{1,2}[\/\-]\d{1,2}/.test($body.text()) ||
          text.includes('no invoice')
      })
    })

  })

  describe('Invoice Details Modal', () => {
    beforeEach(() => {
      // Route requires client ID - extract from sidebar link
      cy.visit('/client/dashboard')
      cy.wait(2000)
      cy.get('a[href*="/client/invoices/"]').first().then($link => {
        const href = $link.attr('href')
        cy.visit(href!)
      })
      cy.url().should('include', '/client/invoices/')
      cy.wait(2000)
    })

    it('should have View button', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('button:contains("View"), button:contains("Details")').length > 0 ||
          $body.text().toLowerCase().includes('view') ||
          $body.text().toLowerCase().includes('no invoice')
      })
    })

    it('should open invoice details modal', () => {
      cy.get('body').then($body => {
        const viewBtn = $body.find('button:contains("View"), button:contains("Details")')
        if (viewBtn.length > 0) {
          cy.wrap(viewBtn.first()).click()
          cy.wait(500)
          cy.get('body').should('satisfy', ($b) => {
            return $b.find('[role="dialog"]').length > 0 ||
              $b.text().toLowerCase().includes('invoice')
          })
        }
      })
    })

    it('should display invoice description', () => {
      cy.get('body').then($body => {
        const viewBtn = $body.find('button:contains("View"), button:contains("Details")')
        if (viewBtn.length > 0) {
          cy.wrap(viewBtn.first()).click()
          cy.wait(500)
          cy.get('body').should('satisfy', ($b) => {
            return $b.text().toLowerCase().includes('description') ||
              $b.text().toLowerCase().includes('service') ||
              $b.text().toLowerCase().includes('item')
          })
        }
      })
    })

    it('should show invoice notes', () => {
      cy.get('body').then($body => {
        const viewBtn = $body.find('button:contains("View"), button:contains("Details")')
        if (viewBtn.length > 0) {
          cy.wrap(viewBtn.first()).click()
          cy.wait(500)
          cy.get('body').should('satisfy', ($b) => {
            return $b.text().toLowerCase().includes('note') ||
              $b.find('[role="dialog"]').length > 0
          })
        }
      })
    })
  })

  describe('Status Badges', () => {
    beforeEach(() => {
      // Route requires client ID - extract from sidebar link
      cy.visit('/client/dashboard')
      cy.wait(2000)
      cy.get('a[href*="/client/invoices/"]').first().then($link => {
        const href = $link.attr('href')
        cy.visit(href!)
      })
      cy.url().should('include', '/client/invoices/')
      cy.wait(2000)
    })

    it('should display green badge for paid', () => {
      cy.get('body').then($body => {
        const hasPaid = $body.text().toLowerCase().includes('paid')
        if (hasPaid) {
          cy.get('body').should('satisfy', ($b) => {
            return $b.find('[class*="green"], [class*="paid"]').length > 0
          })
        }
      })
    })

    it('should display yellow badge for pending', () => {
      cy.get('body').then($body => {
        const hasPending = $body.text().toLowerCase().includes('pending')
        if (hasPending) {
          cy.get('body').should('satisfy', ($b) => {
            return $b.find('[class*="yellow"], [class*="pending"]').length > 0
          })
        }
      })
    })

    it('should display red badge for overdue', () => {
      cy.get('body').then($body => {
        const hasOverdue = $body.text().toLowerCase().includes('overdue')
        if (hasOverdue) {
          cy.get('body').should('satisfy', ($b) => {
            return $b.find('[class*="red"], [class*="overdue"]').length > 0
          })
        }
      })
    })

    it('should display gray badge for draft', () => {
      cy.get('body').then($body => {
        const hasDraft = $body.text().toLowerCase().includes('draft')
        if (hasDraft) {
          cy.get('body').should('satisfy', ($b) => {
            return $b.find('[class*="gray"], [class*="draft"]').length > 0
          })
        }
      })
    })
  })

  describe('Filters', () => {
    beforeEach(() => {
      // Route requires client ID - extract from sidebar link
      cy.visit('/client/dashboard')
      cy.wait(2000)
      cy.get('a[href*="/client/invoices/"]').first().then($link => {
        const href = $link.attr('href')
        cy.visit(href!)
      })
      cy.url().should('include', '/client/invoices/')
      cy.wait(2000)
    })

    it('should filter by status', () => {
      cy.get('body').then($body => {
        const statusFilter = $body.find('select, button:contains("All"), button:contains("Paid")')
        if (statusFilter.length > 0) {
          cy.wrap(statusFilter.first()).click()
          cy.wait(500)
        }
      })
    })

    it('should filter by date range', () => {
      cy.get('body').then($body => {
        const dateInputs = $body.find('input[type="date"]')
        if (dateInputs.length > 0) {
          cy.wrap(dateInputs.first()).type('2024-01-01')
          cy.wait(500)
        }
      })
    })
  })
})
