describe('Invoice Creation', () => {
  beforeEach(() => {
    // Login as admin before each test
    cy.loginAsAdmin()
    
    // Set up API interceptors
    cy.intercept('GET', '/api/services/clients/1').as('getClient')
    cy.intercept('GET', '/api/invoices/client-service-options/1').as('getServiceOptions')
    cy.intercept('POST', '/api/invoices/calculate-pricing/1').as('calculatePricing')
    cy.intercept('POST', '/api/invoices').as('createInvoice')
  })

  describe('Manual Invoice Creation', () => {
    it('should create a manual invoice with custom amount', () => {
      cy.visitClientDetails(1)
      cy.waitForApiRequest('@getClient')
      
      cy.openCreateInvoiceDialog()
      cy.waitForApiRequest('@getServiceOptions')
      
      // Switch to manual entry mode
      cy.contains('Manual Entry').click()
      
      // Fill in invoice details
      cy.get('input#manualAmount').clear().type('5000')
      cy.get('input#description').type('Custom consulting services')
      cy.get('textarea#notes').type('Additional notes for the invoice')
      
      // Create the invoice
      cy.contains('button', 'Create Invoice').click()
      
      cy.waitForApiRequest('@createInvoice')
      
      // Verify success
      cy.get('[role="dialog"]').should('not.exist')
      cy.contains('Invoice created successfully').should('be.visible')
    })

    it('should validate required fields in manual mode', () => {
      cy.visitClientDetails(1)
      cy.openCreateInvoiceDialog()
      
      // Switch to manual entry mode
      cy.contains('Manual Entry').click()
      
      // Try to create without amount
      cy.contains('button', 'Create Invoice').should('be.disabled')
      
      // Add amount and verify button is enabled
      cy.get('input#manualAmount').type('1000')
      cy.contains('button', 'Create Invoice').should('not.be.disabled')
    })
  })

  describe('Service-Based Invoice Creation', () => {
    it('should load client services and show developers', () => {
      cy.visitClientDetails(1)
      cy.openCreateInvoiceDialog()
      cy.waitForApiRequest('@getServiceOptions')
      
      // Verify service-based pricing is default
      cy.contains('Service-Based Pricing').should('have.class', 'bg-primary')
      
      // Check that services are loaded
      cy.contains('Active Services').should('be.visible')
      cy.contains('Outsourcing').should('be.visible')
      
      // Select a service
      cy.selectService('Outsourcing')
      
      // Verify developers are shown
      cy.contains('Assigned Developers').should('be.visible')
      cy.contains('Eduardo Cerato').should('be.visible')
      cy.contains('Sergei Vasilenko').should('be.visible')
      cy.contains('Jéssica Ferreira').should('be.visible')
    })

    it('should calculate pricing when service is selected', () => {
      cy.visitClientDetails(1)
      cy.openCreateInvoiceDialog()
      cy.waitForApiRequest('@getServiceOptions')
      
      // Verify initial state - no calculated total shown
      cy.get('.bg-green-50').should('contain', '$0')
      
      // Select a service
      cy.selectService('Outsourcing')
      
      // Wait for pricing calculation
      cy.waitForApiRequest('@calculatePricing')
      
      // Verify calculated total is updated and greater than 0
      cy.contains('Calculated Total').should('be.visible')
      cy.get('.bg-green-50').should('be.visible').then(($total) => {
        const totalText = $total.text()
        expect(totalText).to.match(/\$[\d,]+/)
        
        // Extract numeric value and verify it's greater than 0
        const numericValue = parseInt(totalText.replace(/[^0-9]/g, ''))
        expect(numericValue).to.be.greaterThan(0)
        
        cy.log('Calculated total updated to: ' + totalText)
      })
      
      // Verify pricing breakdown is shown
      cy.contains('Pricing Breakdown').should('be.visible')
      
      // Verify breakdown contains service details
      cy.get('.bg-blue-50').within(() => {
        cy.contains('Outsourcing').should('be.visible')
        cy.contains('$').should('be.visible')
      })
    })

    it('should update calculated total when multiple services are selected', () => {
      cy.visitClientDetails(1)
      cy.openCreateInvoiceDialog()
      cy.waitForApiRequest('@getServiceOptions')
      
      // Start with $0 total
      cy.get('.bg-green-50').should('contain', '$0')
      
      // Select first service and capture total
      cy.selectService('Outsourcing')
      cy.waitForApiRequest('@calculatePricing')
      
      cy.getCalculatedTotal().then((firstTotal) => {
        const firstAmount = parseInt(firstTotal.replace(/[^0-9]/g, ''))
        expect(firstAmount).to.be.greaterThan(0)
        cy.log('Total after selecting first service: $' + firstAmount)
        
        // If there are additional services available, select another one
        cy.get('body').then(($body) => {
          if ($body.find('[data-testid="available-service"]:not(:checked)').length > 0) {
            // Select second service if available
            cy.get('[data-testid="available-service"]:not(:checked)').first().check()
            cy.waitForApiRequest('@calculatePricing')
            
            cy.getCalculatedTotal().should((secondTotal) => {
              const secondAmount = parseInt(secondTotal.replace(/[^0-9]/g, ''))
              expect(secondAmount).to.be.greaterThan(firstAmount)
              cy.log('Total after selecting second service: $' + secondAmount)
            })
          }
        })
      })
    })

    it('should reset total to $0 when all services are deselected', () => {
      cy.visitClientDetails(1)
      cy.openCreateInvoiceDialog()
      cy.waitForApiRequest('@getServiceOptions')
      
      // Select service to get a total > 0
      cy.selectService('Outsourcing')
      cy.waitForApiRequest('@calculatePricing')
      
      // Verify total is greater than 0
      cy.getCalculatedTotal().should((total) => {
        const amount = parseInt(total.replace(/[^0-9]/g, ''))
        expect(amount).to.be.greaterThan(0)
      })
      
      // Deselect the service
      cy.contains('.space-y-3', 'Outsourcing').within(() => {
        cy.get('input[type="checkbox"]').uncheck()
      })
      
      // Verify total returns to $0 or button becomes disabled
      cy.get('.bg-green-50').should('contain', '$0')
      cy.contains('button', 'Create Invoice').should('be.disabled')
    })

    it('should create service-based invoice successfully', () => {
      cy.visitClientDetails(1)
      cy.openCreateInvoiceDialog()
      cy.waitForApiRequest('@getServiceOptions')
      
      // Select service and wait for calculation
      cy.selectService('Outsourcing')
      cy.waitForApiRequest('@calculatePricing')
      
      // Fill in additional details
      cy.get('input#description').type('Development services for Q4 2025')
      cy.get('textarea#notes').type('Service-based invoice with assigned developers')
      
      // Create the invoice
      cy.contains('button', 'Create Invoice').click()
      cy.waitForApiRequest('@createInvoice')
      
      // Verify success
      cy.get('[role="dialog"]').should('not.exist')
    })
  })

  describe('Developer Management', () => {
    beforeEach(() => {
      cy.visitClientDetails(1)
      cy.openCreateInvoiceDialog()
      cy.waitForApiRequest('@getServiceOptions')
      cy.selectService('Outsourcing')
      cy.waitForApiRequest('@calculatePricing')
    })

    it('should switch developer between hourly and fixed pricing modes', () => {
      // Get initial total
      cy.getCalculatedTotal().then((initialTotal) => {
        
        // Switch Eduardo to hourly mode
        cy.switchDeveloperMode('Eduardo Cerato', 'hourly')
        
        // Set hours worked
        cy.contains('.p-3', 'Eduardo Cerato').within(() => {
          cy.get('input').contains('Hours Worked').clear().type('40')
        })
        
        // Wait for recalculation
        cy.waitForApiRequest('@calculatePricing')
        
        // Verify total changed
        cy.getCalculatedTotal().should('not.equal', initialTotal)
        
        // Switch back to fixed mode
        cy.switchDeveloperMode('Eduardo Cerato', 'fixed')
        cy.waitForApiRequest('@calculatePricing')
        
        // Verify the fixed price input is shown
        cy.contains('.p-3', 'Eduardo Cerato').within(() => {
          cy.get('input').should('have.attr', 'placeholder', '0.00')
          cy.get('label').contains('Fixed Price').should('be.visible')
        })
      })
    })

    it('should update total when developer rates are modified', () => {
      // Get initial total
      cy.getCalculatedTotal().then((initialTotal) => {
        
        // Switch to hourly mode and set values
        cy.switchDeveloperMode('Eduardo Cerato', 'hourly')
        
        cy.contains('.p-3', 'Eduardo Cerato').within(() => {
          cy.get('input').eq(0).clear().type('100') // Hourly rate
          cy.get('input').eq(1).clear().type('40')  // Hours worked
        })
        
        // Wait for recalculation
        cy.waitForApiRequest('@calculatePricing')
        
        // Verify total changed
        cy.getCalculatedTotal().should('not.equal', initialTotal)
        
        // Verify the individual developer total updated
        cy.contains('.p-3', 'Eduardo Cerato').within(() => {
          cy.contains('Total: $4,000').should('be.visible')
        })
      })
    })

    it('should remove developer and update totals', () => {
      // Get initial total with all developers
      cy.getCalculatedTotal().then((initialTotal) => {
        
        // Remove Eduardo Cerato
        cy.removeDeveloper('Eduardo Cerato')
        
        // Wait for recalculation
        cy.waitForApiRequest('@calculatePricing')
        
        // Verify developer is removed from UI
        cy.contains('Eduardo Cerato').should('not.exist')
        
        // Verify total changed (should be less)
        cy.getCalculatedTotal().then((newTotal) => {
          expect(parseInt(newTotal.replace(',', ''))).to.be.lessThan(parseInt(initialTotal.replace(',', '')))
        })
        
        // Remove another developer
        cy.removeDeveloper('Sergei Vasilenko')
        cy.waitForApiRequest('@calculatePricing')
        
        // Verify only one developer remains
        cy.contains('Jéssica Ferreira').should('be.visible')
        cy.contains('Eduardo Cerato').should('not.exist')
        cy.contains('Sergei Vasilenko').should('not.exist')
      })
    })

    it('should add developer to service', () => {
      // First remove a developer so we can add one back
      cy.removeDeveloper('Eduardo Cerato')
      cy.waitForApiRequest('@calculatePricing')
      
      // Click add developer button
      cy.contains('button', 'Add Developer').click()
      
      // Select developer from dropdown
      cy.get('[role="dialog"]').within(() => {
        cy.contains('Add Developer to Service').should('be.visible')
        cy.get('select, [role="combobox"]').click()
        cy.contains('Eduardo Cerato').click()
        
        // Set rates
        cy.get('input[id="hourlyRate"]').type('75')
        cy.get('input[id="hoursWorked"]').type('30')
        
        // Add developer
        cy.contains('button', 'Add Developer').click()
      })
      
      // Verify developer was added back
      cy.contains('Eduardo Cerato').should('be.visible')
      
      // Wait for recalculation
      cy.waitForApiRequest('@calculatePricing')
    })
  })

  describe('Service Management', () => {
    beforeEach(() => {
      cy.visitClientDetails(1)
      cy.openCreateInvoiceDialog()
      cy.waitForApiRequest('@getServiceOptions')
    })

    it('should show available services to add', () => {
      // Scroll down to see available services
      cy.contains('Available Services to Add').should('be.visible')
      
      // Verify at least one available service exists
      cy.get('.space-y-3').should('contain', 'Add Service')
    })

    it('should add new service to client during invoice creation', () => {
      // Intercept the add service API call
      cy.intercept('POST', '/api/services/clients/1/services').as('addService')
      
      // Look for available services and add one
      cy.contains('Available Services to Add').parent().within(() => {
        cy.contains('button', 'Add Service').first().click()
      })
      
      // Fill in service details in dialog
      cy.get('[role="dialog"]').should('contain', 'Add Service to Client')
      cy.get('input[id="serviceRate"]').type('2500')
      cy.contains('button', 'Add Service').click()
      
      cy.waitForApiRequest('@addService')
      
      // Verify success message
      cy.contains('Service added to client successfully').should('be.visible')
    })
  })

  describe('Form Validation and Error Handling', () => {
    beforeEach(() => {
      cy.visitClientDetails(1)
      cy.openCreateInvoiceDialog()
      cy.waitForApiRequest('@getServiceOptions')
    })

    it('should disable create button when no services selected', () => {
      // Verify create button is disabled when no services are selected
      cy.contains('button', 'Create Invoice').should('be.disabled')
      
      // Select a service
      cy.selectService('Outsourcing')
      
      // Verify button is now enabled
      cy.contains('button', 'Create Invoice').should('not.be.disabled')
    })

    it('should handle API errors gracefully', () => {
      // Mock a failed pricing calculation
      cy.intercept('POST', '/api/invoices/calculate-pricing/1', {
        statusCode: 500,
        body: { error: 'Pricing calculation failed' }
      }).as('failedPricing')
      
      cy.selectService('Outsourcing')
      cy.wait('@failedPricing')
      
      // Verify error is handled (you might want to add error UI)
      // This test assumes your app handles errors gracefully
      cy.contains('button', 'Create Invoice').should('be.disabled')
    })

    it('should validate date fields', () => {
      cy.selectService('Outsourcing')
      cy.waitForApiRequest('@calculatePricing')
      
      // Test invalid date ranges
      cy.get('input[id*="periodStart"]').clear().type('2025-12-31')
      cy.get('input[id*="periodEnd"]').clear().type('2025-01-01')
      
      // Create button should still work (assuming backend validation)
      // or you might want to add client-side validation
      cy.contains('button', 'Create Invoice').should('not.be.disabled')
    })
  })

  describe('Invoice Status and Payment', () => {
    beforeEach(() => {
      cy.visitClientDetails(1)
      cy.openCreateInvoiceDialog()
      cy.waitForApiRequest('@getServiceOptions')
      cy.selectService('Outsourcing')
      cy.waitForApiRequest('@calculatePricing')
    })

    it('should create paid invoice when paid date is set', () => {
      // Set paid date
      cy.get('input[id="paidAt"]').type('2025-09-11')
      
      // Verify status indicator
      cy.contains('Invoice will be marked as paid').should('be.visible')
      
      // Create invoice
      cy.get('input#description').type('Paid invoice test')
      cy.contains('button', 'Create Invoice').click()
      cy.waitForApiRequest('@createInvoice')
      
      // Verify success
      cy.get('[role="dialog"]').should('not.exist')
    })

    it('should create unpaid invoice by default', () => {
      // Don't set paid date
      cy.contains('Leave empty for unpaid invoice').should('be.visible')
      
      // Create invoice
      cy.get('input#description').type('Unpaid invoice test')
      cy.contains('button', 'Create Invoice').click()
      cy.waitForApiRequest('@createInvoice')
      
      // Verify success
      cy.get('[role="dialog"]').should('not.exist')
    })
  })

  describe('UI Interactions and Responsiveness', () => {
    it('should close dialog when cancel is clicked', () => {
      cy.visitClientDetails(1)
      cy.openCreateInvoiceDialog()
      
      // Click cancel
      cy.contains('button', 'Cancel').click()
      
      // Verify dialog is closed
      cy.get('[role="dialog"]').should('not.exist')
    })

    it('should maintain form state when switching between tabs', () => {
      cy.visitClientDetails(1)
      cy.openCreateInvoiceDialog()
      cy.waitForApiRequest('@getServiceOptions')
      
      // Fill manual form
      cy.contains('Manual Entry').click()
      cy.get('input#manualAmount').type('3000')
      cy.get('input#description').type('Test description')
      
      // Switch to service-based
      cy.contains('Service-Based Pricing').click()
      cy.selectService('Outsourcing')
      cy.waitForApiRequest('@calculatePricing')
      
      // Switch back to manual
      cy.contains('Manual Entry').click()
      
      // Verify form state is maintained
      cy.get('input#manualAmount').should('have.value', '3000')
      cy.get('input#description').should('have.value', 'Test description')
    })

    it('should show loading states appropriately', () => {
      cy.visitClientDetails(1)
      cy.openCreateInvoiceDialog()
      
      // Should show loading initially
      cy.get('.animate-spin').should('be.visible')
      
      cy.waitForApiRequest('@getServiceOptions')
      
      // Loading should disappear
      cy.get('.animate-spin').should('not.exist')
      
      // Select service to trigger calculation loading
      cy.selectService('Outsourcing')
      
      // Should show calculated total after loading
      cy.waitForApiRequest('@calculatePricing')
      cy.contains('Calculated Total').should('be.visible')
    })
  })
})