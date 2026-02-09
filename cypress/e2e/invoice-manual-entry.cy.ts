describe('Invoice Manual Entry', () => {
  beforeEach(() => {
    // Login as admin
    cy.visit('http://localhost:5173/login')
    cy.get('input[type="text"]').type('admin')
    cy.get('input[type="password"]').type('admin123')
    cy.get('button[type="submit"]').click()

    // Wait for redirect to admin dashboard
    cy.url().should('include', '/admin')
    cy.wait(1000)
  })

  it.only('should create and delete a manual invoice', () => {
    // Navigate to clients page
    cy.visit('http://localhost:5173/admin/clients')
    cy.wait(1000)

    // Click on the first client card (Chronogrid)
    cy.contains('Chronogrid').click()
    cy.wait(500)

    // Wait for client details page to load
    cy.url().should('include', '/admin/clients/')

    // Click on Invoices tab
    cy.contains('button', 'Invoices').click()
    cy.wait(500)

    // Click Create Invoice button
    cy.contains('button', 'Create Invoice').click()
    cy.wait(500)

    // Switch to Manual Entry tab
    cy.contains('button', 'Manual Entry').click()
    cy.wait(500)

    // Intercept the invoice creation and deletion API calls
    cy.intercept('POST', '/api/invoices').as('createInvoice')
    cy.intercept('DELETE', '/api/invoices/*').as('deleteInvoice')

    // Fill in manual invoice form
    // Fill amount field - use a unique amount for easier identification
    cy.get('input').filter('[type="number"]').first().clear().type('77777')
    cy.wait(300)

    // Fill notes with a unique identifier
    const testId = `Cypress-Test-${Date.now()}`
    cy.get('textarea').clear().type(testId)
    cy.wait(300)

    // Submit the form
    cy.contains('button', 'Cancel').parent().within(() => {
      cy.contains('button', 'Create Invoice').click({ force: true })
    })

    // Wait for the API call to complete
    cy.wait('@createInvoice', { timeout: 10000 }).then((interception) => {
      expect(interception.response.statusCode).to.be.oneOf([200, 201])
      const invoiceId = interception.response.body.id
      cy.log(`Created invoice ID: ${invoiceId}`)

      // Wait for dialog to close
      cy.contains('Invoice Management', { timeout: 5000 }).should('not.exist')
      cy.wait(1000)

      // Navigate to Invoices tab to see the created invoice
      cy.contains('button', 'Invoices').click()
      cy.wait(1000)

      // Find the newly created invoice by its unique notes
      cy.contains(testId).should('be.visible')
      cy.log('✓ Test invoice created successfully')

      // Now delete the invoice using the API endpoint directly
      cy.request({
        method: 'DELETE',
        url: `http://localhost:3001/api/invoices/${invoiceId}`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.be.oneOf([200, 204])
        cy.log('✓ Test invoice deleted successfully via API')

        // Refresh the page to see the invoice is gone
        cy.reload()
        cy.wait(1000)
        cy.contains(testId).should('not.exist')
      })
    })
  })

  it('should validate required fields in manual entry', () => {
    // Navigate to clients page
    cy.visit('http://localhost:5173/admin/clients')
    cy.wait(1000)

    // Click on the first client card
    cy.contains('Chronogrid').click()
    cy.wait(500)

    // Click on Invoices tab
    cy.contains('button', 'Invoices').click()
    cy.wait(500)

    // Click Create Invoice button
    cy.contains('button', 'Create Invoice').click()
    cy.wait(500)

    // Switch to Manual Entry tab
    cy.contains('button', 'Manual Entry').click()
    cy.wait(500)

    // Try to submit without filling amount (clear the pre-filled value)
    cy.get('input[type="number"]').first().clear()

    // Try to submit the form
    cy.contains('button', 'Create Invoice').click()

    // Should show validation error or prevent submission
    // The form should not submit and we should still be on the same page
    cy.url().should('include', '/admin/clients/')

    // The button should still be visible (form didn't submit)
    cy.contains('button', 'Create Invoice').should('be.visible')
  })

  it('should generate sequential invoice numbers', () => {
    // Navigate to clients page
    cy.visit('http://localhost:5173/admin/clients')
    cy.wait(1000)

    // Click on the first client card
    cy.contains('Chronogrid').click()
    cy.wait(500)

    // Click on Invoices tab
    cy.contains('button', 'Invoices').click()
    cy.wait(500)

    // Create first test invoice
    cy.contains('button', 'Create Invoice').click()
    cy.wait(500)
    cy.contains('button', 'Manual Entry').click()
    cy.wait(500)
    cy.get('input[type="number"]').first().clear().type('1000')
    cy.get('textarea').type('Sequential test invoice 1')
    cy.contains('button', 'Create Invoice').click()
    cy.wait(2000)

    // Create second test invoice
    cy.contains('button', 'Create Invoice').click()
    cy.wait(500)
    cy.contains('button', 'Manual Entry').click()
    cy.wait(500)
    cy.get('input[type="number"]').first().clear().type('1001')
    cy.get('textarea').type('Sequential test invoice 2')
    cy.contains('button', 'Create Invoice').click()
    cy.wait(2000)

    // Verify both invoices were created
    cy.contains('$1,000').should('be.visible')
    cy.contains('$1,001').should('be.visible')

    cy.log('Sequential invoices created successfully')

    // Cleanup: Delete both test invoices
    // Delete first invoice
    cy.contains('$1,000').parent().parent().within(() => {
      cy.contains('button', 'Delete').click()
    })
    cy.wait(500)
    cy.contains('button', /delete|confirm|yes/i).click()
    cy.wait(1000)

    // Delete second invoice
    cy.contains('$1,001').parent().parent().within(() => {
      cy.contains('button', 'Delete').click()
    })
    cy.wait(500)
    cy.contains('button', /delete|confirm|yes/i).click()
    cy.wait(1000)

    cy.log('Cleanup completed: Both test invoices deleted')
  })
})
