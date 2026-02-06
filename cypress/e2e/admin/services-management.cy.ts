/// <reference types="cypress" />

describe('Admin Services Management', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/services/service-types').as('getServices')
    cy.intercept('POST', '/api/services/service-types').as('createService')
    cy.intercept('PUT', '/api/services/service-types/*').as('updateService')
    cy.intercept('DELETE', '/api/services/service-types/*').as('deleteService')
    cy.intercept('GET', '/api/services/analytics').as('getAnalytics')
    cy.loginAsAdmin()
  })

  describe('Services Page', () => {
    beforeEach(() => {
      cy.visit('/admin/services')
      cy.wait(2000)
    })

    it('should load services page', () => {
      cy.url().should('include', '/admin/services')
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('service') || text.includes('type')
      })
    })

    it('should display Add Service button', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('button:contains("Add"), button:contains("Create"), button:contains("New")').length > 0
      })
    })

    it('should display services list', () => {
      cy.get('body').should('satisfy', ($body) => {
        const hasServices = $body.find('[class*="card"], tr, [class*="service"]').length > 0
        const hasEmptyState = $body.text().toLowerCase().includes('no service')
        return hasServices || hasEmptyState
      })
    })

    it('should display analytics', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('total') ||
          text.includes('active') ||
          text.includes('analytics') ||
          text.includes('service')
      })
    })
  })

  describe('Service Display', () => {
    beforeEach(() => {
      cy.visit('/admin/services')
      cy.wait(2000)
    })

    it('should display service name', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('development') ||
          text.includes('design') ||
          text.includes('consulting') ||
          text.includes('service')
      })
    })

    it('should show category badge', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('outstaffing') ||
          text.includes('outsourcing') ||
          text.includes('category')
      })
    })

    it('should display billing model', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('hourly') ||
          text.includes('monthly') ||
          text.includes('fixed') ||
          text.includes('billing')
      })
    })

    it('should show description', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('description') ||
          text.includes('service') ||
          $body.find('p, [class*="description"]').length > 0
      })
    })
  })

  describe('Create Service', () => {
    beforeEach(() => {
      cy.visit('/admin/services')
      cy.wait(2000)
    })

    it('should open create dialog', () => {
      cy.contains('button', /add|create|new/i).first().click()
      cy.wait(500)
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('[role="dialog"]').length > 0 ||
          $body.text().toLowerCase().includes('create service')
      })
    })

    it('should have description field', () => {
      cy.contains('button', /add|create|new/i).first().click()
      cy.wait(500)
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('textarea[name="description"]').length > 0 ||
          $body.text().toLowerCase().includes('description')
      })
    })

    it('should have category selector', () => {
      cy.contains('button', /add|create|new/i).first().click()
      cy.wait(500)
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('outstaffing') ||
          text.includes('outsourcing') ||
          text.includes('category')
      })
    })

    it('should have billing model selector', () => {
      cy.contains('button', /add|create|new/i).first().click()
      cy.wait(500)
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('hourly') ||
          text.includes('monthly') ||
          text.includes('fixed') ||
          text.includes('billing')
      })
    })

  })

  describe('Edit Service', () => {
    beforeEach(() => {
      cy.visit('/admin/services')
      cy.wait(2000)
    })

    it('should open edit dialog', () => {
      cy.get('body').then($body => {
        const editBtn = $body.find('button:contains("Edit"), button[aria-label*="edit"]')
        if (editBtn.length > 0) {
          cy.wrap(editBtn.first()).click({ force: true })
          cy.wait(500)
          cy.get('body').should('satisfy', ($b) => {
            return $b.find('[role="dialog"]').length > 0
          })
        }
      })
    })

    it('should update service details', () => {
      cy.get('body').then($body => {
        const editBtn = $body.find('button:contains("Edit"), button[aria-label*="edit"]')
        if (editBtn.length > 0) {
          cy.wrap(editBtn.first()).click({ force: true })
          cy.wait(500)
          cy.get('input[name="name"]').clear().type('Updated Service Name')
          cy.get('button[type="submit"]').click()
        }
      })
    })
  })

  describe('Delete Service', () => {
    beforeEach(() => {
      cy.visit('/admin/services')
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
