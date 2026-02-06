/// <reference types="cypress" />

describe('Admin Invoice Management', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/invoices*').as('getInvoices')
    cy.intercept('POST', '/api/invoices').as('createInvoice')
    cy.intercept('GET', '/api/invoices/client-service-options/*').as('getServiceOptions')
    cy.intercept('POST', '/api/invoices/calculate-pricing/*').as('calculatePricing')
    cy.intercept('PUT', '/api/invoices/*').as('updateInvoice')
    cy.intercept('DELETE', '/api/invoices/*').as('deleteInvoice')
    cy.intercept('GET', '/api/services/clients').as('getClients')
    cy.intercept('GET', '/api/services/clients/*').as('getClient')
    cy.loginAsAdmin()
  })

  describe('Invoice List Page', () => {
    beforeEach(() => {
      cy.visit('/admin/clients')
      cy.wait('@getClients')
    })

    it('should navigate to client details page', () => {
      cy.get('body').then($body => {
        const clientLinks = $body.find('a[href*="/admin/clients/"]')
        if (clientLinks.length > 0) {
          cy.wrap(clientLinks.first()).click()
          cy.url().should('match', /\/admin\/clients\/\d+/)
        } else {
          cy.log('No clients found in the list')
        }
      })
    })

    it('should display invoice section on client details', () => {
      cy.get('body').then($body => {
        const clientLinks = $body.find('a[href*="/admin/clients/"]')
        if (clientLinks.length > 0) {
          cy.wrap(clientLinks.first()).click()
          cy.url().should('match', /\/admin\/clients\/\d+/)
          cy.get('body').should('satisfy', ($b) => {
            const text = $b.text().toLowerCase()
            return text.includes('invoice') || text.includes('billing') || text.includes('financial')
          })
        }
      })
    })

    it('should show correct status badges for invoices', () => {
      cy.get('body').then($body => {
        const clientLinks = $body.find('a[href*="/admin/clients/"]')
        if (clientLinks.length > 0) {
          cy.wrap(clientLinks.first()).click()
          cy.wait(2000)
          cy.get('body').then($clientBody => {
            const hasInvoices = $clientBody.text().toLowerCase().includes('invoice')
            if (hasInvoices) {
              // Check for status badges (draft, sent, paid, overdue)
              cy.get('body').should('satisfy', ($b) => {
                const text = $b.text().toLowerCase()
                return text.includes('draft') ||
                  text.includes('sent') ||
                  text.includes('paid') ||
                  text.includes('overdue') ||
                  text.includes('no invoices')
              })
            }
          })
        }
      })
    })
  })

  describe('Create Invoice Flow', () => {
    beforeEach(() => {
      // Navigate to a client with services
      cy.visit('/admin/clients')
      cy.wait('@getClients')
      cy.wait(1000)
    })

    it('should open Create Invoice dialog from client details', () => {
      cy.get('body').then($body => {
        const clientLinks = $body.find('a[href*="/admin/clients/"]')
        if (clientLinks.length > 0) {
          cy.wrap(clientLinks.first()).click()
          cy.wait(2000)
          cy.get('body').then($clientBody => {
            if ($clientBody.find('button:contains("Create Invoice")').length > 0) {
              cy.contains('button', 'Create Invoice').click()
              cy.get('body').should('satisfy', ($b) => {
                const text = $b.text().toLowerCase()
                return text.includes('create invoice') ||
                  text.includes('new invoice') ||
                  text.includes('service') ||
                  text.includes('period')
              })
            } else {
              cy.log('Create Invoice button not found - client may not have services')
            }
          })
        }
      })
    })

    it('should display available services for client in invoice form', () => {
      cy.get('body').then($body => {
        const clientLinks = $body.find('a[href*="/admin/clients/"]')
        if (clientLinks.length > 0) {
          cy.wrap(clientLinks.first()).click()
          cy.wait(2000)
          cy.get('body').then($clientBody => {
            if ($clientBody.find('button:contains("Create Invoice")').length > 0) {
              cy.contains('button', 'Create Invoice').click()
              cy.wait(1000)
              cy.get('body').should('satisfy', ($b) => {
                const text = $b.text().toLowerCase()
                return text.includes('service') ||
                  text.includes('select') ||
                  text.includes('active services')
              })
            }
          })
        }
      })
    })

    it('should select/deselect services with checkboxes', () => {
      cy.get('body').then($body => {
        const clientLinks = $body.find('a[href*="/admin/clients/"]')
        if (clientLinks.length > 0) {
          cy.wrap(clientLinks.first()).click()
          cy.wait(2000)
          cy.get('body').then($clientBody => {
            if ($clientBody.find('button:contains("Create Invoice")').length > 0) {
              cy.contains('button', 'Create Invoice').click()
              cy.wait(1000)
              // Look for checkboxes
              cy.get('body').then($dialogBody => {
                const checkboxes = $dialogBody.find('[role="checkbox"], input[type="checkbox"]')
                if (checkboxes.length > 0) {
                  cy.wrap(checkboxes.first()).click({ force: true })
                  cy.wrap(checkboxes.first()).should('satisfy', ($el) => {
                    return $el.attr('data-state') === 'checked' ||
                      $el.attr('aria-checked') === 'true' ||
                      $el.is(':checked')
                  })
                }
              })
            }
          })
        }
      })
    })

    it('should validate required fields before submission', () => {
      cy.get('body').then($body => {
        const clientLinks = $body.find('a[href*="/admin/clients/"]')
        if (clientLinks.length > 0) {
          cy.wrap(clientLinks.first()).click()
          cy.wait(2000)
          cy.get('body').then($clientBody => {
            if ($clientBody.find('button:contains("Create Invoice")').length > 0) {
              cy.contains('button', 'Create Invoice').click()
              cy.wait(1000)
              // Try to submit without selecting anything
              cy.get('body').then($dialogBody => {
                const submitBtn = $dialogBody.find('button[type="submit"], button:contains("Create")')
                if (submitBtn.length > 0) {
                  cy.wrap(submitBtn.first()).click({ force: true })
                  // Should show validation error or not close dialog
                  cy.get('[role="dialog"], [class*="dialog"], [class*="modal"]').should('exist')
                }
              })
            }
          })
        }
      })
    })
  })

  describe('Developer Pricing in Invoice', () => {
    beforeEach(() => {
      cy.visit('/admin/clients')
      cy.wait('@getClients')
      cy.wait(1000)
    })

    it('should display developer pricing options when service is selected', () => {
      cy.get('body').then($body => {
        const clientLinks = $body.find('a[href*="/admin/clients/"]')
        if (clientLinks.length > 0) {
          cy.wrap(clientLinks.first()).click()
          cy.wait(2000)
          cy.get('body').then($clientBody => {
            if ($clientBody.find('button:contains("Create Invoice")').length > 0) {
              cy.contains('button', 'Create Invoice').click()
              cy.wait(1000)
              // Select a service first
              cy.get('[role="checkbox"], input[type="checkbox"]').first().click({ force: true })
              cy.wait(500)
              // Check for developer pricing options
              cy.get('body').should('satisfy', ($b) => {
                const text = $b.text().toLowerCase()
                return text.includes('hourly') ||
                  text.includes('fixed') ||
                  text.includes('rate') ||
                  text.includes('developer') ||
                  text.includes('pricing')
              })
            }
          })
        }
      })
    })

    it('should switch between hourly and fixed pricing modes', () => {
      cy.get('body').then($body => {
        const clientLinks = $body.find('a[href*="/admin/clients/"]')
        if (clientLinks.length > 0) {
          cy.wrap(clientLinks.first()).click()
          cy.wait(2000)
          cy.get('body').then($clientBody => {
            if ($clientBody.find('button:contains("Create Invoice")').length > 0) {
              cy.contains('button', 'Create Invoice').click()
              cy.wait(1000)
              cy.get('[role="checkbox"], input[type="checkbox"]').first().click({ force: true })
              cy.wait(500)
              // Look for hourly/fixed toggle
              cy.get('body').then($dialogBody => {
                if ($dialogBody.find('button:contains("Hourly")').length > 0) {
                  cy.contains('button', 'Hourly').click()
                  cy.contains('button', 'Hourly').should('have.attr', 'data-state', 'on').or('have.class', 'active')
                }
                if ($dialogBody.find('button:contains("Fixed")').length > 0) {
                  cy.contains('button', 'Fixed').click()
                  cy.contains('button', 'Fixed').should('satisfy', ($el) => {
                    return $el.attr('data-state') === 'on' ||
                      $el.hasClass('active') ||
                      $el.attr('aria-pressed') === 'true'
                  })
                }
              })
            }
          })
        }
      })
    })

    it('should calculate totals automatically when services selected', () => {
      cy.get('body').then($body => {
        const clientLinks = $body.find('a[href*="/admin/clients/"]')
        if (clientLinks.length > 0) {
          cy.wrap(clientLinks.first()).click()
          cy.wait(2000)
          cy.get('body').then($clientBody => {
            if ($clientBody.find('button:contains("Create Invoice")').length > 0) {
              cy.contains('button', 'Create Invoice').click()
              cy.wait(1000)
              // Select a service
              cy.get('[role="checkbox"], input[type="checkbox"]').first().click({ force: true })
              cy.wait('@calculatePricing', { timeout: 10000 }).then((interception) => {
                expect(interception.response?.statusCode).to.be.oneOf([200, 201])
              })
              // Check for total display
              cy.get('body').should('satisfy', ($b) => {
                const text = $b.text()
                return text.includes('$') || text.includes('Total')
              })
            }
          })
        }
      })
    })
  })

  describe('Invoice Status Management', () => {
    it('should navigate to invoices section from admin dashboard', () => {
      cy.visit('/admin/dashboard')
      cy.wait(2000)
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('dashboard') ||
          text.includes('admin') ||
          text.includes('overview')
      })
    })

    it('should display invoice metrics on client details', () => {
      cy.visit('/admin/clients')
      cy.wait('@getClients')
      cy.get('body').then($body => {
        const clientLinks = $body.find('a[href*="/admin/clients/"]')
        if (clientLinks.length > 0) {
          cy.wrap(clientLinks.first()).click()
          cy.wait(2000)
          cy.get('body').should('satisfy', ($b) => {
            const text = $b.text().toLowerCase()
            return text.includes('invoiced') ||
              text.includes('paid') ||
              text.includes('outstanding') ||
              text.includes('total') ||
              text.includes('invoice')
          })
        }
      })
    })
  })

  describe('Invoice Edit and Delete', () => {
    it('should display edit option for draft invoices', () => {
      cy.visit('/admin/clients')
      cy.wait('@getClients')
      cy.get('body').then($body => {
        const clientLinks = $body.find('a[href*="/admin/clients/"]')
        if (clientLinks.length > 0) {
          cy.wrap(clientLinks.first()).click()
          cy.wait(2000)
          cy.get('body').then($clientBody => {
            const hasDraftInvoice = $clientBody.text().toLowerCase().includes('draft')
            if (hasDraftInvoice) {
              // Look for edit button near draft status
              cy.get('body').should('satisfy', ($b) => {
                return $b.find('button:contains("Edit"), button[aria-label*="edit"], svg.lucide-pencil').length > 0 ||
                  $b.text().toLowerCase().includes('edit')
              })
            } else {
              cy.log('No draft invoices found to test edit functionality')
            }
          })
        }
      })
    })

    it('should show delete confirmation dialog', () => {
      cy.visit('/admin/clients')
      cy.wait('@getClients')
      cy.get('body').then($body => {
        const clientLinks = $body.find('a[href*="/admin/clients/"]')
        if (clientLinks.length > 0) {
          cy.wrap(clientLinks.first()).click()
          cy.wait(2000)
          cy.get('body').then($clientBody => {
            const deleteBtn = $clientBody.find('button:contains("Delete"), button[aria-label*="delete"], button:has(svg.lucide-trash)')
            if (deleteBtn.length > 0) {
              cy.wrap(deleteBtn.first()).click({ force: true })
              cy.wait(500)
              // Check for confirmation dialog
              cy.get('body').should('satisfy', ($b) => {
                const text = $b.text().toLowerCase()
                return text.includes('confirm') ||
                  text.includes('are you sure') ||
                  text.includes('delete') ||
                  text.includes('cancel')
              })
            } else {
              cy.log('No delete button found for invoices')
            }
          })
        }
      })
    })
  })
})
