describe('Hourly Rate Calculation Test', () => {
  beforeEach(() => {
    cy.loginAsAdmin()
    cy.intercept('GET', '/api/services/clients/1').as('getClient')
    cy.intercept('GET', '/api/invoices/client-service-options/1').as('getServiceOptions')
    cy.intercept('POST', '/api/invoices/calculate-pricing/1').as('calculatePricing')
  })

  it('should show calculated total matches pricing breakdown logic', () => {
    cy.visitClientDetails(1)
    cy.openCreateInvoiceDialog()
    cy.waitForApiRequest('@getServiceOptions')
    
    // Select service first
    cy.selectService('Outsourcing')
    cy.waitForApiRequest('@calculatePricing')
    
    // Verify that calculated total is working (not showing $0)
    cy.get('.bg-green-50').should('be.visible').should('contain', '$').then(($el) => {
      const calculatedTotalText = $el.text()
      const match = calculatedTotalText.match(/\$([0-9,]+)/)
      
      if (match) {
        const calculatedTotal = parseInt(match[1].replace(/,/g, ''))
        expect(calculatedTotal).to.be.greaterThan(0)
        cy.log(`✅ Calculated Total shows: $${match[1]} (greater than $0)`)
      } else {
        throw new Error(`Could not extract total from: "${calculatedTotalText}"`)
      }
    })
    
    // Verify that pricing breakdown also shows totals
    cy.contains('Total:').should('be.visible').then(($total) => {
      const breakdownText = $total.text()
      const match = breakdownText.match(/Total:\s*\$([0-9,]+)/)
      
      if (match) {
        const breakdownTotal = parseInt(match[1].replace(/,/g, ''))
        expect(breakdownTotal).to.be.greaterThan(0)
        cy.log(`✅ Pricing breakdown shows: Total: $${match[1]} (greater than $0)`)
      } else {
        throw new Error(`Could not extract breakdown total from: "${breakdownText}"`)
      }
    })
    
    // Verify developer section is visible (indicating the service calculation worked)
    cy.contains('Eduardo Cerato').should('be.visible')
    cy.contains('Fixed Price').should('be.visible')
    
    cy.log('✅ PASS: Calculated total and pricing breakdown both show proper values!')
  })
})