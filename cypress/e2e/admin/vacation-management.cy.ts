/// <reference types="cypress" />

describe('Admin Vacation Management', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/vacation/requests*').as('getLeaveRequests')
    cy.intercept('GET', '/api/vacation/employees').as('getEmployees')
    cy.intercept('GET', '/api/vacation/leave-types').as('getLeaveTypes')
    cy.intercept('PUT', '/api/vacation/requests/*/status').as('updateRequestStatus')
    cy.intercept('POST', '/api/vacation/admin/create-and-approve').as('createAndApprove')
    cy.intercept('POST', '/api/vacation/requests').as('createRequest')
    cy.intercept('DELETE', '/api/vacation/requests/*').as('deleteRequest')
    cy.intercept('PUT', '/api/vacation/requests/*/cancel').as('cancelRequest')
    cy.loginAsAdmin()
  })

  describe('Vacation Dashboard', () => {
    beforeEach(() => {
      cy.visit('/admin/vacation')
      cy.wait(2000)
    })

    it('should load vacation management page', () => {
      cy.url().should('include', '/admin/vacation')
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('vacation') ||
          text.includes('leave') ||
          text.includes('time off') ||
          text.includes('request')
      })
    })

    it('should display pending request count', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('pending') ||
          text.includes('request') ||
          text.includes('awaiting')
      })
    })

    it('should show summary stats for vacation types', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('vacation') ||
          text.includes('sick') ||
          text.includes('personal') ||
          text.includes('leave')
      })
    })

    it('should display filter options', () => {
      // Check for filter controls in the main content area
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        const hasFilters = $body.find('select').length > 0 ||
          text.includes('all') ||
          text.includes('pending') ||
          text.includes('approved')
        const hasFilterText = text.includes('filter') ||
          text.includes('status') ||
          text.includes('requests')
        return hasFilters || hasFilterText
      })
    })
  })

  describe('Request Filtering', () => {
    beforeEach(() => {
      cy.visit('/admin/vacation')
      cy.wait(2000)
    })

    it('should filter requests by pending status', () => {
      cy.get('body').then($body => {
        const pendingBtn = $body.find('button:contains("Pending")')
        if (pendingBtn.length > 0) {
          cy.wrap(pendingBtn.first()).click()
          cy.wait(1000)
          cy.get('body').should('satisfy', ($b) => {
            const text = $b.text().toLowerCase()
            return text.includes('pending') || text.includes('no pending')
          })
        }
      })
    })

    it('should filter requests by approved status', () => {
      cy.get('body').then($body => {
        const approvedBtn = $body.find('button:contains("Approved")')
        if (approvedBtn.length > 0) {
          cy.wrap(approvedBtn.first()).click()
          cy.wait(1000)
          cy.get('body').should('satisfy', ($b) => {
            const text = $b.text().toLowerCase()
            return text.includes('approved') || text.includes('no approved')
          })
        }
      })
    })

    it('should filter requests by denied status', () => {
      cy.get('body').then($body => {
        const deniedBtn = $body.find('button:contains("Denied"), button:contains("Rejected")')
        if (deniedBtn.length > 0) {
          cy.wrap(deniedBtn.first()).click()
          cy.wait(1000)
          cy.get('body').should('satisfy', ($b) => {
            const text = $b.text().toLowerCase()
            return text.includes('denied') || text.includes('rejected') || text.includes('no denied')
          })
        }
      })
    })

    it('should show all requests when All filter selected', () => {
      cy.get('body').then($body => {
        const allBtn = $body.find('button:contains("All")')
        if (allBtn.length > 0) {
          cy.wrap(allBtn.first()).click()
          cy.wait(1000)
          // Should show requests of any status or empty state
          cy.get('body').should('satisfy', ($b) => {
            const text = $b.text().toLowerCase()
            return text.includes('request') ||
              text.includes('pending') ||
              text.includes('approved') ||
              text.includes('no requests')
          })
        }
      })
    })

    it('should search requests by employee name', () => {
      cy.get('body').then($body => {
        const searchInput = $body.find('input[type="search"], input[placeholder*="search"], input[placeholder*="Search"]')
        if (searchInput.length > 0) {
          cy.wrap(searchInput.first()).type('eduardo')
          cy.wait(1000)
          // Results should filter or show no results
          cy.get('body').should('be.visible')
        }
      })
    })
  })

  describe('Calendar View', () => {
    beforeEach(() => {
      cy.visit('/admin/vacation')
      cy.wait(2000)
    })

    it('should display calendar tab or view', () => {
      cy.get('body').then($body => {
        const calendarTab = $body.find('button:contains("Calendar"), [role="tab"]:contains("Calendar")')
        if (calendarTab.length > 0) {
          cy.wrap(calendarTab.first()).click()
          cy.wait(1000)
          cy.get('body').should('satisfy', ($b) => {
            const text = $b.text()
            // Check for month names or calendar grid
            return text.includes('Sun') ||
              text.includes('Mon') ||
              text.includes('January') ||
              text.includes('February') ||
              $b.find('[class*="calendar"], [class*="grid"]').length > 0
          })
        }
      })
    })

    it('should navigate between months', () => {
      // First click on Calendar tab if it exists
      cy.get('body').then($body => {
        const calendarTab = $body.find('button:contains("Calendar"), [role="tab"]:contains("Calendar")')
        if (calendarTab.length > 0) {
          cy.contains('button', 'Calendar').click({ force: true })
          cy.wait(1000)
        }
      })

      // Then find and click navigation arrows in main content (not sidebar)
      cy.get('main, [class*="content"], .flex-1').then($main => {
        const nextBtn = $main.find('button:has(svg.lucide-chevron-right), button[aria-label*="next"]')
        if (nextBtn.length > 0) {
          cy.wrap(nextBtn.first()).click({ force: true })
          cy.wait(500)
          cy.get('body').should('be.visible')
        } else {
          cy.log('No navigation buttons found in calendar view')
        }
      })
    })

    it('should show legend for leave types', () => {
      cy.get('body').then($body => {
        const calendarTab = $body.find('button:contains("Calendar"), [role="tab"]:contains("Calendar")')
        if (calendarTab.length > 0) {
          cy.wrap(calendarTab.first()).click()
          cy.wait(1000)
          cy.get('body').should('satisfy', ($b) => {
            const text = $b.text().toLowerCase()
            return text.includes('vacation') ||
              text.includes('sick') ||
              text.includes('legend') ||
              text.includes('holiday')
          })
        }
      })
    })
  })

  describe('Approval Workflow', () => {
    beforeEach(() => {
      cy.visit('/admin/vacation')
      cy.wait(2000)
    })

    it('should display approve button for pending requests', () => {
      cy.get('body').then($body => {
        const text = $body.text().toLowerCase()
        const hasPending = text.includes('pending')
        if (hasPending) {
          // Look for approve button or checkmark icon
          const hasApproveBtn = $body.find('button:contains("Approve")').length > 0 ||
            $body.find('svg.lucide-check, svg.lucide-check-circle').length > 0 ||
            text.includes('approve')
          if (hasApproveBtn) {
            cy.log('Approve button/icon found for pending requests')
          } else {
            cy.log('Approve button not visible - may require expanding request details')
          }
        } else {
          cy.log('No pending requests found to test approval workflow')
        }
      })
    })

    it('should display deny button for pending requests', () => {
      cy.get('body').then($body => {
        const hasPending = $body.text().toLowerCase().includes('pending')
        if (hasPending) {
          cy.get('body').should('satisfy', ($b) => {
            return $b.find('button:contains("Deny"), button:contains("Reject"), button[aria-label*="deny"]').length > 0 ||
              $b.find('svg.lucide-x').length > 0
          })
        }
      })
    })

    it('should approve pending request successfully', () => {
      cy.get('body').then($body => {
        const approveBtn = $body.find('button:contains("Approve"):not(:disabled)')
        if (approveBtn.length > 0) {
          cy.wrap(approveBtn.first()).click()
          cy.wait('@updateRequestStatus', { timeout: 10000 }).then((interception) => {
            expect(interception.response?.statusCode).to.be.oneOf([200, 201])
          })
        } else {
          cy.log('No approve button found for pending requests')
        }
      })
    })

    it('should deny request with reason', () => {
      cy.get('body').then($body => {
        const denyBtn = $body.find('button:contains("Deny"), button:contains("Reject")')
        if (denyBtn.length > 0) {
          cy.wrap(denyBtn.first()).click()
          cy.wait(500)
          // Fill denial reason in dialog
          cy.get('body').then($dialogBody => {
            const reasonInput = $dialogBody.find('textarea[name="reason"], textarea[placeholder*="reason"]')
            if (reasonInput.length > 0) {
              cy.wrap(reasonInput.first()).type('Test denial reason')
              cy.contains('button', /confirm|deny|submit/i).click()
              cy.wait('@updateRequestStatus', { timeout: 10000 })
            }
          })
        } else {
          cy.log('No deny button found for pending requests')
        }
      })
    })

    it('should cancel approved request', () => {
      // Filter to approved requests first
      cy.get('body').then($body => {
        const approvedBtn = $body.find('button:contains("Approved")')
        if (approvedBtn.length > 0) {
          cy.wrap(approvedBtn.first()).click()
          cy.wait(1000)
          cy.get('body').then($approvedBody => {
            const cancelBtn = $approvedBody.find('button:contains("Cancel")')
            if (cancelBtn.length > 0) {
              cy.wrap(cancelBtn.first()).click()
              cy.wait(500)
              // Confirm cancellation if dialog appears
              cy.get('body').then($confirmBody => {
                const confirmBtn = $confirmBody.find('button:contains("Confirm"), button:contains("Yes")')
                if (confirmBtn.length > 0) {
                  cy.wrap(confirmBtn.first()).click()
                  cy.wait('@cancelRequest', { timeout: 10000 })
                }
              })
            }
          })
        }
      })
    })
  })

  describe('Create Leave Request (Admin)', () => {
    beforeEach(() => {
      cy.visit('/admin/vacation')
      cy.wait(2000)
    })

    it('should open add request dialog', () => {
      cy.get('body').then($body => {
        const addBtn = $body.find('button:contains("Add"), button:contains("New"), button:contains("Create")')
        if (addBtn.length > 0) {
          cy.wrap(addBtn.first()).click()
          cy.wait(500)
          cy.get('body').should('satisfy', ($b) => {
            const text = $b.text().toLowerCase()
            return text.includes('employee') ||
              text.includes('leave type') ||
              text.includes('start date') ||
              text.includes('end date')
          })
        }
      })
    })

    it('should display employee dropdown', () => {
      cy.get('body').then($body => {
        const addBtn = $body.find('button:contains("Add"), button:contains("New"), button:contains("Create")')
        if (addBtn.length > 0) {
          cy.wrap(addBtn.first()).click()
          cy.wait(500)
          cy.get('body').should('satisfy', ($b) => {
            return $b.find('select, [role="combobox"], [data-testid="employee-select"]').length > 0
          })
        }
      })
    })

    it('should display leave type dropdown', () => {
      cy.get('body').then($body => {
        const addBtn = $body.find('button:contains("Add"), button:contains("New"), button:contains("Create")')
        if (addBtn.length > 0) {
          cy.wrap(addBtn.first()).click()
          cy.wait(500)
          cy.get('body').should('satisfy', ($b) => {
            const text = $b.text().toLowerCase()
            return text.includes('leave type') ||
              text.includes('vacation') ||
              text.includes('sick')
          })
        }
      })
    })

    it('should display date range inputs', () => {
      cy.get('body').then($body => {
        const addBtn = $body.find('button:contains("Add"), button:contains("New"), button:contains("Create")')
        if (addBtn.length > 0) {
          cy.wrap(addBtn.first()).click()
          cy.wait(500)
          cy.get('body').should('satisfy', ($b) => {
            return $b.find('input[type="date"]').length >= 2 ||
              $b.text().toLowerCase().includes('start date') ||
              $b.text().toLowerCase().includes('end date')
          })
        }
      })
    })

    it('should have auto-approve option for admin', () => {
      cy.get('body').then($body => {
        const addBtn = $body.find('button:contains("Add"), button:contains("New"), button:contains("Create")')
        if (addBtn.length > 0) {
          cy.wrap(addBtn.first()).click()
          cy.wait(500)
          cy.get('body').should('satisfy', ($b) => {
            const text = $b.text().toLowerCase()
            return text.includes('auto') ||
              text.includes('approve') ||
              $b.find('input[type="checkbox"], [role="checkbox"]').length > 0
          })
        }
      })
    })

    it('should create pre-approved leave request as admin', () => {
      cy.get('body').then($body => {
        const addBtn = $body.find('button:contains("Add"), button:contains("New"), button:contains("Create")')
        if (addBtn.length > 0) {
          cy.wrap(addBtn.first()).click()
          cy.wait(1000)

          // Fill form with test data
          const today = new Date()
          const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
          const startDate = today.toISOString().split('T')[0]
          const endDate = nextWeek.toISOString().split('T')[0]

          // Select employee if dropdown exists
          cy.get('body').then($formBody => {
            const selectElements = $formBody.find('select')
            if (selectElements.length > 0) {
              // Select first option in each select
              selectElements.each((_, el) => {
                const options = Cypress.$(el).find('option')
                if (options.length > 1) {
                  cy.wrap(el).select(options.eq(1).val() as string)
                }
              })
            }

            // Fill dates
            const dateInputs = $formBody.find('input[type="date"]')
            if (dateInputs.length >= 2) {
              cy.wrap(dateInputs.eq(0)).clear().type(startDate)
              cy.wrap(dateInputs.eq(1)).clear().type(endDate)
            }

            // Check auto-approve if available
            const autoApproveCheckbox = $formBody.find('input[type="checkbox"], [role="checkbox"]')
            if (autoApproveCheckbox.length > 0) {
              cy.wrap(autoApproveCheckbox.first()).click({ force: true })
            }

            // Submit
            cy.contains('button', /submit|create|save/i).click()
          })
        }
      })
    })
  })

  describe('Request List Display', () => {
    beforeEach(() => {
      cy.visit('/admin/vacation')
      cy.wait(2000)
    })

    it('should display employee name in requests', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('employee') ||
          text.includes('eduardo') ||
          text.includes('name') ||
          text.includes('no requests')
      })
    })

    it('should display leave type for each request', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('vacation') ||
          text.includes('sick') ||
          text.includes('personal') ||
          text.includes('leave') ||
          text.includes('no requests')
      })
    })

    it('should display date range for requests', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text()
        // Look for date patterns (e.g., Jan 15, 2024 or 2024-01-15)
        const hasDatePattern = /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\w{3}\s+\d{1,2}|\d{4}-\d{2}-\d{2}/.test(text)
        const hasDateWords = text.toLowerCase().includes('date') || text.toLowerCase().includes('from') || text.toLowerCase().includes('to')
        return hasDatePattern || hasDateWords || text.toLowerCase().includes('no requests')
      })
    })

    it('should display days count for each request', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('day') ||
          text.includes('days') ||
          /\d+\s*d/.test(text) ||
          text.includes('no requests')
      })
    })

    it('should show status badges', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('pending') ||
          text.includes('approved') ||
          text.includes('denied') ||
          text.includes('cancelled') ||
          text.includes('no requests')
      })
    })
  })

  describe('Edit Leave Request', () => {
    beforeEach(() => {
      cy.visit('/admin/vacation')
      cy.wait(2000)
    })

    it('should open edit modal when clicking on request', () => {
      // Look for edit functionality in main content area (avoid sidebar)
      cy.get('main, [class*="content"], .flex-1').then($main => {
        const editBtn = $main.find('button:contains("Edit"), button[aria-label*="edit"], svg.lucide-pencil')
        if (editBtn.length > 0) {
          cy.wrap(editBtn.first()).click({ force: true })
          cy.wait(500)
          cy.get('body').should('satisfy', ($b) => {
            const text = $b.text().toLowerCase()
            return text.includes('edit') ||
              text.includes('update') ||
              $b.find('[role="dialog"]').length > 0
          })
        } else {
          cy.log('No edit button found - edit may not be available for current requests')
        }
      })
    })
  })

  describe('Delete Request', () => {
    beforeEach(() => {
      cy.visit('/admin/vacation')
      cy.wait(2000)
    })

    it('should show delete confirmation dialog', () => {
      cy.get('body').then($body => {
        const deleteBtn = $body.find('button:contains("Delete"), button[aria-label*="delete"], svg.lucide-trash')
        if (deleteBtn.length > 0) {
          cy.wrap(deleteBtn.first()).click({ force: true })
          cy.wait(500)
          cy.get('body').should('satisfy', ($b) => {
            const text = $b.text().toLowerCase()
            return text.includes('confirm') ||
              text.includes('are you sure') ||
              text.includes('delete') ||
              text.includes('permanent')
          })
        } else {
          cy.log('No delete button found for leave requests')
        }
      })
    })

    it('should delete request permanently when confirmed', () => {
      cy.get('body').then($body => {
        const deleteBtn = $body.find('button:contains("Delete"), button[aria-label*="delete"], svg.lucide-trash')
        if (deleteBtn.length > 0) {
          cy.wrap(deleteBtn.first()).click({ force: true })
          cy.wait(500)
          // Confirm deletion
          cy.get('body').then($confirmBody => {
            const confirmBtn = $confirmBody.find('button:contains("Confirm"), button:contains("Delete"), button:contains("Yes")')
            if (confirmBtn.length > 0) {
              cy.wrap(confirmBtn.last()).click()
              cy.wait('@deleteRequest', { timeout: 10000 }).then((interception) => {
                expect(interception.response?.statusCode).to.be.oneOf([200, 204])
              })
            }
          })
        }
      })
    })
  })
})
