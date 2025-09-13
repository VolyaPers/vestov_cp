describe('Basic Functionality Test', () => {
  beforeEach(() => {
    cy.loginAsAdmin()
    cy.intercept('GET', '/api/services/clients/1').as('getClient')
    cy.intercept('GET', '/api/invoices/client-service-options/1').as('getServiceOptions')
    cy.intercept('POST', '/api/invoices/calculate-pricing/1').as('calculatePricing')
  })

  it('should successfully select service and trigger calculation', () => {
    cy.visitClientDetails(1)
    cy.openCreateInvoiceDialog()
    cy.waitForApiRequest('@getServiceOptions')
    
    // Verify initial state
    cy.contains('Active Services').should('be.visible')
    cy.contains('Outsourcing').should('be.visible')
    
    // Select service
    cy.selectService('Outsourcing')
    
    // Wait for API call to complete
    cy.waitForApiRequest('@calculatePricing').then((interception) => {
      expect(interception.response?.statusCode).to.equal(200)
      expect(interception.response?.body).to.have.property('totalAmount')
      cy.log(`Server response received with totalAmount: ${interception.response?.body.totalAmount}`)
    })
    
    // Verify UI shows calculated total (should work with fallback calculation even if server returns 0)
    cy.get('.bg-green-50').should('be.visible').should('contain', '$').then(($el) => {
      const text = $el.text()
      const match = text.match(/\$([0-9,]+)/)
      if (match) {
        const total = parseInt(match[1].replace(/,/g, ''))
        expect(total).to.be.greaterThan(0)
        cy.log(`✅ UI Calculated Total shows: $${match[1]}`)
      } else {
        throw new Error(`Could not extract total from: "${text}"`)
      }
    })
    
    // Verify UI shows developer details
    cy.contains('Assigned Developers').should('be.visible')
    cy.contains('Eduardo Cerato').should('be.visible')
    cy.contains('Total:').should('be.visible')
    
    cy.log('✅ PASS: Core service selection and calculation functionality works!')
  })

  it('should show service is checked after selection', () => {
    cy.visitClientDetails(1)
    cy.openCreateInvoiceDialog()
    cy.waitForApiRequest('@getServiceOptions')
    
    // Verify service can be selected
    cy.selectService('Outsourcing')
    
    // Verify the service appears selected (developer section shows)
    cy.contains('Assigned Developers').should('be.visible')
    cy.contains('Eduardo Cerato').should('be.visible')
    
    cy.log('✅ PASS: Service selection UI feedback works!')
  })
})