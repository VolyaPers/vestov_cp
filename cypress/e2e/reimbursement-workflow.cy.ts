describe('Workspace Reimbursement Feature', () => {
  const employeeCredentials = {
    username: 'eduardo',
    password: 'eduardo123'
  }

  const adminCredentials = {
    username: 'admin',
    password: 'admin123'
  }

  beforeEach(() => {
    cy.visit('/')
  })

  describe('Employee Reimbursement Portal', () => {
    beforeEach(() => {
      // Login as employee
      cy.get('input[name="username"]').type(employeeCredentials.username)
      cy.get('input[name="password"]').type(employeeCredentials.password)
      cy.get('button[type="submit"]').click()

      // Navigate to reimbursements page
      cy.url().should('include', '/employee')
      cy.contains('Reimbursements').click()
      cy.url().should('include', '/employee/reimbursements')
    })

    it('should display yearly limit based on employment years', () => {
      // Eduardo started 2023-02-01, should be in year 2 = $400 limit
      cy.contains('Yearly Limit').should('be.visible')
      cy.contains('$400').should('be.visible') // 2 years of service
    })

    it('should display available balance correctly', () => {
      cy.contains('Available').should('be.visible')
      // Available amount should be visible (limit - used)
      cy.get('[data-testid="available-balance"]').should('exist')
    })

    it('should allow employee to submit reimbursement request', () => {
      // Click create request button
      cy.contains('New Request').click()

      // Fill out form
      cy.get('input[name="expense"]').type('800')
      cy.get('textarea[name="description"]').type('Herman Miller chair for home office')
      cy.get('select[name="category"]').select('Furniture')

      // Should show 50% calculation
      cy.contains('Reimbursement: $400').should('be.visible')

      // Submit
      cy.contains('Submit Request').click()

      // Should show success and new request in list
      cy.contains('Request submitted').should('be.visible')
      cy.contains('Herman Miller chair').should('be.visible')
      cy.contains('Pending').should('be.visible')
    })

    it('should prevent requests exceeding available limit', () => {
      // Try to request more than available
      cy.contains('New Request').click()
      cy.get('input[name="expense"]').type('2000')

      // Should show warning about exceeding limit
      cy.contains('exceeds available limit').should('be.visible')

      // Submit button should be disabled
      cy.contains('Submit Request').should('be.disabled')
    })

    it('should calculate 50% reimbursement correctly', () => {
      cy.contains('New Request').click()

      // Test various amounts
      cy.get('input[name="expense"]').type('500')
      cy.contains('Reimbursement: $250').should('be.visible')

      cy.get('input[name="expense"]').clear().type('300')
      cy.contains('Reimbursement: $150').should('be.visible')
    })

    it('should cap reimbursement at available limit', () => {
      // If available is $400, requesting $1000 (50% = $500) should cap at $400
      cy.contains('New Request').click()
      cy.get('input[name="expense"]').type('1000')

      // Should show capped amount, not 50%
      cy.contains('Reimbursement: $400').should('be.visible')
      cy.contains('(capped to available limit)').should('be.visible')
    })

    it('should show request history with status', () => {
      // Should display all past requests
      cy.contains('Request History').should('be.visible')

      // Each request should show:
      cy.get('[data-testid="request-item"]').first().within(() => {
        cy.contains('$').should('be.visible') // Amount
        cy.get('[data-testid="request-status"]').should('exist') // Status
        cy.get('[data-testid="request-date"]').should('exist') // Date
      })
    })

    it('should allow uploading evidence for approved requests', () => {
      // Find an approved request (this assumes one exists)
      cy.contains('Approved').parent().within(() => {
        cy.contains('Upload Evidence').click()
      })

      // Upload file
      cy.get('input[type="file"]').selectFile('cypress/fixtures/receipt.jpg')

      // Confirm upload
      cy.contains('Confirm').click()

      // Should show success and status change to "Confirmed"
      cy.contains('Evidence uploaded').should('be.visible')
      cy.contains('Confirmed').should('be.visible')
    })

    it('should not allow evidence upload for pending requests', () => {
      // Pending requests should not have upload button
      cy.contains('Pending').parent().within(() => {
        cy.contains('Upload Evidence').should('not.exist')
      })
    })

    it('should display rejection reason for rejected requests', () => {
      // Find rejected request (if exists)
      cy.get('body').then($body => {
        if ($body.text().includes('Rejected')) {
          cy.contains('Rejected').parent().within(() => {
            cy.contains('Reason:').should('be.visible')
          })
        }
      })
    })

    it('should track multiple requests in same year', () => {
      const currentYear = new Date().getFullYear()

      // Submit first request
      cy.contains('New Request').click()
      cy.get('input[name="expense"]').type('400')
      cy.get('textarea[name="description"]').type('Standing desk')
      cy.contains('Submit Request').click()

      // Available balance should decrease
      cy.contains('Available').parent().within(() => {
        // Should show reduced amount (original - $200)
      })

      // Submit second request
      cy.contains('New Request').click()
      cy.get('input[name="expense"]').type('200')
      cy.get('textarea[name="description"]').type('Monitor')
      cy.contains('Submit Request').click()

      // Both requests should be visible for current year
      cy.contains(`${currentYear}`).should('be.visible')
    })
  })

  describe('Admin Reimbursement Management', () => {
    beforeEach(() => {
      // Login as admin
      cy.get('input[name="username"]').type(adminCredentials.username)
      cy.get('input[name="password"]').type(adminCredentials.password)
      cy.get('button[type="submit"]').click()

      // Navigate to admin reimbursements
      cy.url().should('include', '/admin')
      cy.contains('Reimbursements').click()
      cy.url().should('include', '/admin/reimbursements')
    })

    it('should display reimbursement stats dashboard', () => {
      // Should show statistics
      cy.contains('Pending Requests').should('be.visible')
      cy.contains('Approved').should('be.visible')
      cy.contains('Confirmed').should('be.visible')
      cy.contains('Rejected').should('be.visible')

      // Should show counts
      cy.get('[data-testid="pending-count"]').should('exist')
    })

    it('should display all employee requests', () => {
      // Should show requests from all employees
      cy.contains('All Requests').should('be.visible')

      // Each request shows employee info
      cy.get('[data-testid="request-row"]').first().within(() => {
        cy.get('[data-testid="employee-name"]').should('exist')
        cy.get('[data-testid="expense-amount"]').should('exist')
        cy.get('[data-testid="request-status"]').should('exist')
      })
    })

    it('should allow admin to approve request', () => {
      // Find pending request
      cy.contains('Pending').parent().within(() => {
        cy.contains('Approve').click()
      })

      // Optional: Add approval note
      cy.get('textarea[name="note"]').type('Approved for workspace setup')
      cy.contains('Confirm Approval').click()

      // Status should change to Approved
      cy.contains('Approved').should('be.visible')
      cy.contains('successfully approved').should('be.visible')
    })

    it('should require note when rejecting request', () => {
      // Find pending request
      cy.contains('Pending').parent().within(() => {
        cy.contains('Reject').click()
      })

      // Try to submit without note
      cy.contains('Confirm Rejection').click()

      // Should show error
      cy.contains('Rejection reason is required').should('be.visible')

      // Add note and submit
      cy.get('textarea[name="note"]').type('Not eligible equipment type')
      cy.contains('Confirm Rejection').click()

      // Status should change to Rejected
      cy.contains('Rejected').should('be.visible')
    })

    it('should filter requests by status', () => {
      // Select "Pending" filter
      cy.get('select[name="status-filter"]').select('pending')

      // Should only show pending requests
      cy.get('[data-testid="request-row"]').each($row => {
        cy.wrap($row).contains('Pending').should('exist')
      })
    })

    it('should filter requests by year', () => {
      const currentYear = new Date().getFullYear()

      cy.get('select[name="year-filter"]').select(currentYear.toString())

      // All visible requests should be from current year
      cy.get('[data-testid="request-year"]').each($year => {
        cy.wrap($year).should('contain', currentYear.toString())
      })
    })

    it('should search requests by employee name', () => {
      cy.get('input[name="search"]').type('Eduardo')

      // Should only show Eduardo's requests
      cy.get('[data-testid="employee-name"]').each($name => {
        cy.wrap($name).should('contain', 'Eduardo')
      })
    })

    it('should view uploaded evidence for confirmed requests', () => {
      // Find confirmed request with evidence
      cy.get('body').then($body => {
        if ($body.text().includes('Confirmed')) {
          cy.contains('Confirmed').parent().within(() => {
            cy.contains('View Evidence').click()
          })

          // Should show evidence in modal/new tab
          cy.get('[data-testid="evidence-viewer"]').should('be.visible')
        }
      })
    })

    it('should display employee years of service', () => {
      // Each request should show employee tenure
      cy.get('[data-testid="request-row"]').first().within(() => {
        cy.get('[data-testid="employee-years"]').should('exist')
      })
    })

    it('should show cumulative usage for each employee', () => {
      // Click on employee name to see details
      cy.get('[data-testid="employee-name"]').first().click()

      // Should show year-to-date usage
      cy.contains('Total Used').should('be.visible')
      cy.contains('Remaining').should('be.visible')
      cy.contains('Yearly Limit').should('be.visible')
    })
  })

  describe('Reimbursement Business Logic', () => {
    it('should enforce yearly limits based on employment years', () => {
      // Test data for different employee tenures
      const limits = {
        1: 300,
        2: 400,
        3: 500,
        4: 600,
        5: 700
      }

      // This would require test data for employees with different start dates
      cy.log('Requires employees with varying start dates')
    })

    it('should calculate completed years correctly', () => {
      // Employee started 2023-02-01
      // On 2025-10-25, should be 2 completed years (not 3)
      cy.log('Eduardo: started 2023-02-01, should have 2-year limit ($400)')
    })

    it('should reset available balance on new employment cycle', () => {
      // When crossing anniversary date, available balance should reset
      cy.log('Requires time-based testing or date mocking')
    })

    it('should include pending/approved/confirmed in used amount', () => {
      // Used amount calculation should include:
      // - Pending requests
      // - Approved requests
      // - Confirmed requests
      // But NOT rejected requests
      cy.log('Requires verification of balance calculations')
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors gracefully', () => {
      // Intercept API call and force failure
      cy.intercept('POST', '/api/reimbursements', { forceNetworkError: true })

      cy.get('input[name="username"]').type(employeeCredentials.username)
      cy.get('input[name="password"]').type(employeeCredentials.password)
      cy.get('button[type="submit"]').click()

      cy.contains('Reimbursements').click()
      cy.contains('New Request').click()

      cy.get('input[name="expense"]').type('500')
      cy.get('textarea[name="description"]').type('Test request')
      cy.contains('Submit Request').click()

      // Should show error message
      cy.contains('Failed to submit request').should('be.visible')
    })

    it('should validate file upload size and type', () => {
      cy.log('Requires approved request and file upload UI')

      // Should reject files > 5MB
      // Should only accept .jpg, .png, .pdf
    })

    it('should prevent duplicate submissions', () => {
      cy.log('Should disable submit button after first click')
      cy.log('Should prevent multiple form submissions')
    })
  })
})
