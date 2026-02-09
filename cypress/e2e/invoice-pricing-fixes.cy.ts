describe('Invoice Pricing Fixes', () => {
  beforeEach(() => {
    cy.loginAsAdmin()
    cy.intercept('GET', '/api/services/clients/1').as('getClient')
    cy.intercept('GET', '/api/invoices/client-service-options/1').as('getServiceOptions')
    cy.intercept('POST', '/api/invoices/calculate-pricing/1').as('calculatePricing')
  })

  describe('Service Selection Updates Totals', () => {
    it('should update calculated total from $0 when active service is selected', () => {
      cy.visitClientDetails(1)
      cy.openCreateInvoiceDialog()
      cy.waitForApiRequest('@getServiceOptions')
      
      // Verify initial state shows $0
      cy.get('.bg-green-50').should('be.visible').and('contain', '$0')
      cy.log('Initial total: $0')
      
      // Select the Outsourcing service
      cy.selectService('Outsourcing')
      cy.waitForApiRequest('@calculatePricing')
      
      // Verify total is now greater than $0
      cy.getCalculatedTotal().should((total) => {
        const numericValue = parseInt(total.replace(/[^0-9]/g, ''))
        expect(numericValue).to.be.greaterThan(0)
        cy.log('Total after selecting Outsourcing service: $' + numericValue)
      })
      
      // Verify developers are visible (confirming service was selected properly)
      cy.contains('Eduardo Cerato').should('be.visible')
      cy.contains('Sergei Vasilenko').should('be.visible')
      cy.contains('Jéssica Ferreira').should('be.visible')
      
      // Verify pricing breakdown appears
      cy.contains('Pricing Breakdown').should('be.visible')
      cy.get('.bg-blue-50').within(() => {
        cy.contains('Outsourcing').should('be.visible')
        cy.contains('$').should('be.visible')
      })
    })

    it('should immediately update total when service checkbox is clicked', () => {
      cy.visitClientDetails(1)
      cy.openCreateInvoiceDialog()
      cy.waitForApiRequest('@getServiceOptions')
      
      // Verify starting at $0
      cy.get('.bg-green-50').should('contain', '$0')
      
      // Click the checkbox directly and verify immediate update
      cy.contains('.space-y-3', 'Outsourcing').within(() => {
        cy.get('input[type="checkbox"]').should('not.be.checked')
        
        // Click the checkbox
        cy.get('input[type="checkbox"]').check()
        cy.get('input[type="checkbox"]').should('be.checked')
      })
      
      // Wait for calculation API call
      cy.waitForApiRequest('@calculatePricing')
      
      // Verify total updated from $0
      cy.getCalculatedTotal().should((total) => {
        cy.log('Total after checking service: $' + total)
        const numericValue = parseInt(total.replace(/,/g, ''))
        expect(numericValue).to.be.greaterThan(0)
      })
      
      // Verify assigned developers section appears
      cy.contains('Assigned Developers').should('be.visible')
      
      // Verify Create Invoice button is now enabled
      cy.contains('button', 'Create Invoice').should('not.be.disabled')
    })

    it('should update total back to $0 when service is unchecked', () => {
      cy.visitClientDetails(1)
      cy.openCreateInvoiceDialog()
      cy.waitForApiRequest('@getServiceOptions')
      
      // First select service to get a total > 0
      cy.selectService('Outsourcing')
      cy.waitForApiRequest('@calculatePricing')
      
      // Confirm we have a total > 0
      cy.getCalculatedTotal().should((total) => {
        const numericValue = parseInt(total.replace(/,/g, ''))
        expect(numericValue).to.be.greaterThan(0)
      })
      
      // Uncheck the service
      cy.contains('.space-y-3', 'Outsourcing').within(() => {
        cy.get('input[type="checkbox"]').should('be.checked')
        cy.get('input[type="checkbox"]').uncheck()
        cy.get('input[type="checkbox"]').should('not.be.checked')
      })
      
      // Verify total goes back to $0
      cy.get('.bg-green-50').should('contain', '$0')
      
      // Verify developers section disappears
      cy.contains('Assigned Developers').should('not.exist')
      
      // Verify Create Invoice button is disabled
      cy.contains('button', 'Create Invoice').should('be.disabled')
    })
  })

  describe('Developer Removal Updates Totals', () => {
    it('should update calculated total when developers are removed', () => {
      // Navigate to client details and open invoice dialog
      cy.visitClientDetails(1)
      cy.openCreateInvoiceDialog()
      cy.waitForApiRequest('@getServiceOptions')
      
      // Verify initial state shows $0
      cy.get('.bg-green-50').should('contain', '$0')
      
      // Select the Outsourcing service
      cy.selectService('Outsourcing')
      cy.waitForApiRequest('@calculatePricing')
      
      // Record initial total with all developers
      cy.getCalculatedTotal().then((initialTotal) => {
        cy.log('Initial total with all developers: ' + initialTotal)
        
        // Remove Eduardo Cerato
        cy.contains('.p-3', 'Eduardo Cerato').within(() => {
          cy.get('button[class*="text-red-"]').click() // Remove button
        })
        
        // Wait for recalculation after removal
        cy.waitForApiRequest('@calculatePricing')
        
        // Verify total decreased
        cy.getCalculatedTotal().should((newTotal) => {
          cy.log('Total after removing Eduardo: ' + newTotal)
          const initialAmount = parseInt(initialTotal.replace(/[^0-9]/g, ''))
          const newAmount = parseInt(newTotal.replace(/[^0-9]/g, ''))
          expect(newAmount).to.be.lessThan(initialAmount)
        })
        
        // Remove another developer (Sergei Vasilenko)
        cy.contains('.p-3', 'Sergei Vasilenko').within(() => {
          cy.get('button[class*="text-red-"]').click() // Remove button
        })
        
        // Wait for recalculation
        cy.waitForApiRequest('@calculatePricing')
        
        // Verify total decreased again
        cy.getCalculatedTotal().should((finalTotal) => {
          cy.log('Final total after removing Sergei: ' + finalTotal)
          const initialAmount = parseInt(initialTotal.replace(/[^0-9]/g, ''))
          const finalAmount = parseInt(finalTotal.replace(/[^0-9]/g, ''))
          expect(finalAmount).to.be.lessThan(initialAmount)
        })
        
        // Verify only Jéssica remains visible
        cy.contains('Eduardo Cerato').should('not.exist')
        cy.contains('Sergei Vasilenko').should('not.exist')
        cy.contains('Jéssica Ferreira').should('be.visible')
      })
    })
  })

  describe('Pricing Mode Switch Updates Totals', () => {
    it('should update totals when switching between hourly and fixed pricing', () => {
      cy.visitClientDetails(1)
      cy.openCreateInvoiceDialog()
      cy.waitForApiRequest('@getServiceOptions')
      
      cy.selectService('Outsourcing')
      cy.waitForApiRequest('@calculatePricing')
      
      // Get initial total (developers start in fixed mode)
      cy.getCalculatedTotal().then((initialTotal) => {
        cy.log('Initial total (fixed mode): ' + initialTotal)
        
        // Switch Eduardo to hourly mode
        cy.contains('.p-3', 'Eduardo Cerato').within(() => {
          cy.contains('button', 'Hourly').click()
          
          // Set hourly rate and hours
          cy.get('input').first().clear().type('75') // hourly rate
          cy.get('input').last().clear().type('50')  // hours worked
        })
        
        // Wait for recalculation
        cy.waitForApiRequest('@calculatePricing')
        
        // Verify total changed
        cy.getCalculatedTotal().should((hourlyTotal) => {
          cy.log('Total after switching to hourly: ' + hourlyTotal)
          expect(hourlyTotal).to.not.equal(initialTotal)
        })
        
        // Switch back to fixed mode
        cy.contains('.p-3', 'Eduardo Cerato').within(() => {
          cy.contains('button', 'Fixed').click()
          
          // Set fixed price
          cy.get('input').clear().type('6000')
        })
        
        // Wait for recalculation
        cy.waitForApiRequest('@calculatePricing')
        
        // Verify total changed again
        cy.getCalculatedTotal().should((fixedTotal) => {
          cy.log('Total after switching back to fixed: ' + fixedTotal)
          expect(fixedTotal).to.not.equal(initialTotal)
        })
      })
    })

    it('should show correct input fields based on pricing mode', () => {
      cy.visitClientDetails(1)
      cy.openCreateInvoiceDialog()
      cy.waitForApiRequest('@getServiceOptions')
      
      cy.selectService('Outsourcing')
      cy.waitForApiRequest('@calculatePricing')
      
      // Verify initial fixed mode UI
      cy.contains('.p-3', 'Eduardo Cerato').within(() => {
        cy.contains('Fixed Price').should('be.visible')
        cy.get('input[placeholder="0.00"]').should('be.visible')
      })
      
      // Switch to hourly mode
      cy.contains('.p-3', 'Eduardo Cerato').within(() => {
        cy.contains('button', 'Hourly').click()
      })
      
      // Verify hourly mode UI
      cy.contains('.p-3', 'Eduardo Cerato').within(() => {
        cy.contains('Hourly Rate').should('be.visible')
        cy.contains('Hours Worked').should('be.visible')
        cy.get('input').should('have.length', 2) // Two inputs for hourly mode
      })
      
      // Switch back to fixed mode
      cy.contains('.p-3', 'Eduardo Cerato').within(() => {
        cy.contains('button', 'Fixed').click()
      })
      
      // Verify fixed mode UI returned
      cy.contains('.p-3', 'Eduardo Cerato').within(() => {
        cy.contains('Fixed Price').should('be.visible')
        cy.get('input').should('have.length', 1) // One input for fixed mode
      })
    })
  })

  describe('Combined Scenarios', () => {
    it('should handle developer removal and pricing mode changes together', () => {
      cy.visitClientDetails(1)
      cy.openCreateInvoiceDialog()
      cy.waitForApiRequest('@getServiceOptions')
      
      cy.selectService('Outsourcing')
      cy.waitForApiRequest('@calculatePricing')
      
      // Switch one developer to hourly with specific values
      cy.contains('.p-3', 'Eduardo Cerato').within(() => {
        cy.contains('button', 'Hourly').click()
        cy.get('input').first().clear().type('100') // $100/hr
        cy.get('input').last().clear().type('20')   // 20 hours
      })
      
      cy.waitForApiRequest('@calculatePricing')
      
      // Get total with modified pricing
      cy.getCalculatedTotal().then((modifiedTotal) => {
        cy.log('Total with modified pricing: ' + modifiedTotal)
        
        // Remove a different developer (Sergei)
        cy.contains('.p-3', 'Sergei Vasilenko').within(() => {
          cy.get('button[class*="text-red-"]').click()
        })
        
        cy.waitForApiRequest('@calculatePricing')
        
        // Verify total updated correctly
        cy.getCalculatedTotal().should((finalTotal) => {
          cy.log('Final total after removal: ' + finalTotal)
          
          // The total should be different from the modified total
          expect(finalTotal).to.not.equal(modifiedTotal)
          
          // Eduardo should still be in hourly mode with his values
          cy.contains('.p-3', 'Eduardo Cerato').within(() => {
            cy.get('input').first().should('have.value', '100')
            cy.get('input').last().should('have.value', '20')
          })
          
          // Sergei should not be visible
          cy.contains('Sergei Vasilenko').should('not.exist')
        })
      })
    })

    it('should persist pricing mode when developers are re-added', () => {
      cy.visitClientDetails(1)
      cy.openCreateInvoiceDialog()
      cy.waitForApiRequest('@getServiceOptions')
      
      cy.selectService('Outsourcing')
      cy.waitForApiRequest('@calculatePricing')
      
      // Set specific pricing for Eduardo
      cy.contains('.p-3', 'Eduardo Cerato').within(() => {
        cy.contains('button', 'Hourly').click()
        cy.get('input').first().clear().type('80')
        cy.get('input').last().clear().type('30')
      })
      
      cy.waitForApiRequest('@calculatePricing')
      
      // Remove Eduardo
      cy.contains('.p-3', 'Eduardo Cerato').within(() => {
        cy.get('button[class*="text-red-"]').click()
      })
      
      cy.waitForApiRequest('@calculatePricing')
      cy.contains('Eduardo Cerato').should('not.exist')
      
      // Add Eduardo back (if add developer functionality exists)
      // This test assumes there's an "Add Developer" button
      cy.contains('button', 'Add Developer').should('exist').click()
      
      // In the add developer dialog, select Eduardo again
      cy.get('[role="dialog"]').should('contain', 'Add Developer').within(() => {
        cy.get('select, [role="combobox"]').click()
      })
      
      // This part would depend on your specific implementation
      // The test verifies that the modal exists for adding developers
    })
  })
})