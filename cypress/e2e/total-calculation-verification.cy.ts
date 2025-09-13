describe('Total Calculation Verification', () => {
  beforeEach(() => {
    cy.loginAsAdmin()
    cy.intercept('GET', '/api/services/clients/1').as('getClient')
    cy.intercept('GET', '/api/invoices/client-service-options/1').as('getServiceOptions')
    cy.intercept('POST', '/api/invoices/calculate-pricing/1').as('calculatePricing')
  })

  it('CRITICAL: Calculated total must update when active service is selected', () => {
    // This test specifically verifies the core requirement
    cy.visitClientDetails(1)
    cy.openCreateInvoiceDialog()
    cy.waitForApiRequest('@getServiceOptions')
    
    // Step 1: Verify we start at $0
    cy.get('.bg-green-50')
      .should('be.visible')
      .and('contain', '$0')
    
    cy.log('✓ Initial state: Total shows $0')
    
    // Step 2: Select an active service (Outsourcing)
    cy.contains('Active Services').should('be.visible')
    cy.selectService('Outsourcing')
    
    cy.log('✓ Service selected: Outsourcing checkbox checked')
    
    // Step 3: Wait for pricing calculation API call
    cy.waitForApiRequest('@calculatePricing').then((interception) => {
      cy.log('✓ API call completed: /api/invoices/calculate-pricing/1')
      expect(interception.response?.statusCode).to.equal(200)
      expect(interception.response?.body).to.have.property('totalAmount')
      
      const serverTotal = interception.response?.body.totalAmount
      expect(serverTotal).to.be.greaterThan(0)
      
      cy.log(`✓ Server returned total: $${serverTotal}`)
    })
    
    // Step 4: Wait a moment for UI to update, then verify total
    cy.wait(1000) // Give UI time to update
    cy.getCalculatedTotal().should((displayedTotal) => {
      const numericValue = parseInt(displayedTotal.replace(/,/g, ''))
      expect(numericValue).to.be.greaterThan(0)
      
      cy.log(`✓ UI displays total: $${displayedTotal}`)
      cy.log(`✓ PASS: Total updated from $0 to $${displayedTotal} when service selected`)
    })
    
    // Step 5: Verify related UI updates
    cy.contains('Assigned Developers').should('be.visible')
    cy.contains('Eduardo Cerato').should('be.visible')
    cy.contains('Sergei Vasilenko').should('be.visible')
    cy.contains('Jéssica Ferreira').should('be.visible')
    cy.contains('Pricing Breakdown').should('be.visible')
    cy.contains('button', 'Create Invoice').should('not.be.disabled')
    
    cy.log('✓ All related UI elements updated correctly')
  })

  it('CRITICAL: Total calculation reflects real-time changes', () => {
    cy.visitClientDetails(1)
    cy.openCreateInvoiceDialog()
    cy.waitForApiRequest('@getServiceOptions')
    
    // Select service and get initial total
    cy.selectService('Outsourcing')
    cy.waitForApiRequest('@calculatePricing')
    
    cy.getCalculatedTotal().then((initialTotal) => {
      cy.log(`Initial total: $${initialTotal}`)
      
      // Modify a developer's rate to trigger recalculation
      cy.contains('.p-3', 'Eduardo Cerato').within(() => {
        // Switch to hourly mode
        cy.contains('button', 'Hourly').click()
        
        // Set specific values
        cy.get('input').first().clear().type('150') // $150/hr
        cy.get('input').last().clear().type('10')   // 10 hours
      })
      
      // Wait for recalculation
      cy.waitForApiRequest('@calculatePricing')
      
      // Verify total changed
      cy.getCalculatedTotal().should((newTotal) => {
        expect(newTotal).to.not.equal(initialTotal)
        cy.log(`Total updated from $${initialTotal} to $${newTotal}`)
        cy.log('✓ PASS: Total updates in real-time with developer rate changes')
      })
    })
  })

  it('CRITICAL: Deselecting service resets total to $0', () => {
    cy.visitClientDetails(1)
    cy.openCreateInvoiceDialog()
    cy.waitForApiRequest('@getServiceOptions')
    
    // Select service first
    cy.selectService('Outsourcing')
    cy.waitForApiRequest('@calculatePricing')
    
    // Verify we have a total > $0
    cy.getCalculatedTotal().then((total) => {
      const value = parseInt(total.replace(/,/g, ''))
      expect(value).to.be.greaterThan(0)
      cy.log(`Service selected total: $${total}`)
    })
    
    // Deselect service
    cy.selectService('Outsourcing')
    
    // Verify total goes back to $0
    cy.get('.bg-green-50').should('contain', '$0')
    cy.contains('button', 'Create Invoice').should('be.disabled')
    
    cy.log('✓ PASS: Total resets to $0 when service deselected')
  })
})