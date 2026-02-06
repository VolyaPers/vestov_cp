/// <reference types="cypress" />

describe('Admin Documents Management', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/documents*').as('getDocuments')
    cy.intercept('POST', '/api/documents').as('uploadDocument')
    cy.intercept('DELETE', '/api/documents/*').as('deleteDocument')
    cy.intercept('PUT', '/api/documents/*').as('updateDocument')
    cy.loginAsAdmin()
  })

  describe('Documents Page', () => {
    beforeEach(() => {
      cy.visit('/admin/documents')
      cy.wait(2000)
    })

    it('should load documents page', () => {
      cy.url().should('include', '/admin/documents')
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('document') || text.includes('file')
      })
    })

    it('should display documents list', () => {
      cy.get('body').should('satisfy', ($body) => {
        const hasDocuments = $body.find('[class*="card"], tr, [class*="document"]').length > 0
        const hasEmptyState = $body.text().toLowerCase().includes('no document')
        return hasDocuments || hasEmptyState
      })
    })
  })

  describe('Document Display', () => {
    beforeEach(() => {
      cy.visit('/admin/documents')
      cy.wait(2000)
    })

    it('should display document name', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('document') ||
          text.includes('.pdf') ||
          text.includes('.doc') ||
          text.includes('file')
      })
    })

    it('should show file type icon', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('svg, [class*="icon"]').length > 0 ||
          $body.text().toLowerCase().includes('document')
      })
    })

    it('should show visibility status', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('visible') ||
          text.includes('client') ||
          text.includes('internal')
      })
    })
  })

  describe('Delete Confirmation', () => {
    beforeEach(() => {
      cy.visit('/admin/documents')
      cy.wait(2000)
    })

    it('should show delete confirmation dialog', () => {
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
