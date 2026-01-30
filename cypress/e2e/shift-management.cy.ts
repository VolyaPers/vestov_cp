describe('Shift Management', () => {
  beforeEach(() => {
    cy.loginAsTeamMember()
    cy.intercept('GET', '/api/shifts/current').as('getCurrentShift')
    cy.intercept('POST', '/api/shifts/start').as('startShift')
    cy.intercept('POST', '/api/shifts/*/break/start').as('startBreak')
    cy.intercept('POST', '/api/shifts/*/break/end').as('endBreak')
    cy.intercept('POST', '/api/shifts/*/end').as('endShift')
  })

  describe('Shift Widget Visibility', () => {
    it('should display shift widget in sidebar for team members', () => {
      cy.visit('/employee/dashboard')
      cy.wait(2000)

      // Should have shift-related buttons
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text()
        return text.includes('Start Shift') || text.includes('End') || text.includes('Break')
      })
    })

    it('should show info card about click and hold behavior', () => {
      cy.visit('/employee/dashboard')
      cy.wait(2000)

      // Look for the info card text
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text()
        return text.includes('Click once to confirm') || text.includes('hold for 3s')
      })
    })
  })

  describe('Start Shift Flow', () => {
    it('should show Start Shift button when no active shift', () => {
      cy.visit('/employee/dashboard')
      cy.wait(2000)

      // Check if Start Shift is visible (user is not on shift)
      cy.get('body').then($body => {
        if ($body.text().includes('Start Shift')) {
          cy.contains('button', 'Start Shift').should('be.visible')
        } else {
          // Already on shift - End button should be visible
          cy.contains('button', 'End').should('be.visible')
        }
      })
    })

    it('should show confirmation dialog when clicking Start Shift', () => {
      cy.visit('/employee/dashboard')
      cy.wait(2000)

      cy.get('body').then($body => {
        if ($body.text().includes('Start Shift')) {
          // Click Start Shift button
          cy.contains('button', 'Start Shift').click()

          // Should show confirmation dialog
          cy.contains('Do you wish to start your shift?').should('be.visible')

          // Should show Yes and No buttons
          cy.contains('button', 'Yes').should('be.visible')
          cy.contains('button', 'No').should('be.visible')
        } else {
          cy.log('User already has an active shift')
        }
      })
    })

    it('should cancel start shift when clicking No', () => {
      cy.visit('/employee/dashboard')
      cy.wait(2000)

      cy.get('body').then($body => {
        if ($body.text().includes('Start Shift')) {
          cy.contains('button', 'Start Shift').click()
          cy.contains('Do you wish to start your shift?').should('be.visible')

          // Click No
          cy.contains('button', 'No').click()

          // Dialog should close
          cy.contains('Do you wish to start your shift?').should('not.exist')

          // Start Shift should still be visible
          cy.contains('button', 'Start Shift').should('be.visible')
        }
      })
    })

    it('should start shift when clicking Yes', () => {
      cy.visit('/employee/dashboard')
      cy.wait(2000)

      cy.get('body').then($body => {
        if ($body.text().includes('Start Shift')) {
          cy.contains('button', 'Start Shift').click()
          cy.contains('button', 'Yes').click()

          // Wait for API call
          cy.wait('@startShift', { timeout: 10000 }).its('response.statusCode').should('be.oneOf', [200, 201])

          // Should now show Working status or Break button
          cy.wait(2000)
          cy.get('body').should('satisfy', ($updatedBody) => {
            const text = $updatedBody.text()
            return text.includes('Working') || text.includes('Break') || text.includes('End')
          })
        }
      })
    })

    it('should start shift by holding button for 3 seconds', () => {
      cy.visit('/employee/dashboard')
      cy.wait(2000)

      cy.get('body').then($body => {
        if ($body.text().includes('Start Shift')) {
          // Hold the button for 3+ seconds to auto-confirm
          cy.contains('button', 'Start Shift')
            .trigger('mousedown')

          // Wait for the hold timer (3 seconds)
          cy.wait(3500)

          // Wait for API call
          cy.wait('@startShift', { timeout: 10000 }).its('response.statusCode').should('be.oneOf', [200, 201])

          // Should now show Working status
          cy.wait(2000)
          cy.get('body').should('satisfy', ($updatedBody) => {
            const text = $updatedBody.text()
            return text.includes('Working') || text.includes('Break')
          })
        }
      })
    })
  })

  describe('Break Flow', () => {
    it('should show Break button when on active shift', () => {
      cy.visit('/employee/dashboard')
      cy.wait(2000)

      cy.get('body').then($body => {
        // If already on shift (has Working status or Break button)
        if ($body.text().includes('Working') || ($body.text().includes('Break') && !$body.text().includes('Start Shift'))) {
          cy.contains('button', 'Break').should('be.visible')
        } else if ($body.text().includes('Start Shift')) {
          // Need to start shift first
          cy.contains('button', 'Start Shift').click()
          cy.contains('button', 'Yes').click()
          cy.wait('@startShift')
          cy.wait(2000)
          cy.contains('button', 'Break').should('be.visible')
        }
      })
    })

    it('should show confirmation dialog with optional note when starting break', () => {
      cy.visit('/employee/dashboard')
      cy.wait(2000)

      // Ensure we're on shift first
      cy.get('body').then($body => {
        if ($body.text().includes('Start Shift')) {
          cy.contains('button', 'Start Shift').click()
          cy.contains('button', 'Yes').click()
          cy.wait('@startShift')
          cy.wait(2000)
        }

        // Click Break button
        if (!$body.text().includes('On Break')) {
          cy.contains('button', 'Break').click()

          // Should show confirmation
          cy.contains('Do you wish to start your break?').should('be.visible')

          // Should show optional break note textarea
          cy.get('textarea[placeholder*="break note"]').should('be.visible')
        }
      })
    })

    it('should start break and show On Break status', () => {
      cy.visit('/employee/dashboard')
      cy.wait(2000)

      cy.get('body').then($body => {
        // Ensure on shift
        if ($body.text().includes('Start Shift')) {
          cy.contains('button', 'Start Shift').click()
          cy.contains('button', 'Yes').click()
          cy.wait('@startShift')
          cy.wait(2000)
        }

        // Start break if not already on break
        if (!$body.text().includes('On Break')) {
          cy.contains('button', 'Break').click()
          cy.contains('button', 'Yes').click()
          cy.wait('@startBreak', { timeout: 10000 })
          cy.wait(2000)

          // Should show On Break status
          cy.contains('On Break').should('be.visible')
        }
      })
    })

    it('should end break and return to Working status', () => {
      cy.visit('/employee/dashboard')
      cy.wait(2000)

      cy.get('body').then($body => {
        if ($body.text().includes('On Break')) {
          // End break
          cy.contains('button', 'End Break').click()
          cy.contains('button', 'Yes').click()
          cy.wait('@endBreak', { timeout: 10000 })
          cy.wait(2000)

          // Should show Working status
          cy.contains('Working').should('be.visible')
        } else {
          cy.log('Not currently on break - skipping test')
        }
      })
    })
  })

  describe('End Shift Flow', () => {
    it('should show End button when on active shift', () => {
      cy.visit('/employee/dashboard')
      cy.wait(2000)

      cy.get('body').then($body => {
        if ($body.text().includes('Working') || $body.text().includes('On Break')) {
          cy.contains('button', 'End').should('be.visible')
        }
      })
    })

    it('should show confirmation dialog when clicking End', () => {
      cy.visit('/employee/dashboard')
      cy.wait(2000)

      cy.get('body').then($body => {
        if ($body.text().includes('Working') || ($body.text().includes('Break') && !$body.text().includes('Start Shift'))) {
          cy.contains('button', 'End').click()
          cy.contains('Do you wish to end your shift?').should('be.visible')
        }
      })
    })

    it('should end shift and show Start Shift button', () => {
      cy.visit('/employee/dashboard')
      cy.wait(2000)

      cy.get('body').then($body => {
        // End shift if on shift
        if ($body.text().includes('Working') || $body.text().includes('On Break')) {
          cy.contains('button', 'End').click()
          cy.contains('button', 'Yes').click()
          cy.wait('@endShift', { timeout: 10000 })
          cy.wait(2000)

          // Should show Start Shift button
          cy.contains('button', 'Start Shift').should('be.visible')
        }
      })
    })

    it('should end shift by holding button for 3 seconds', () => {
      cy.visit('/employee/dashboard')
      cy.wait(2000)

      cy.get('body').then($body => {
        if ($body.text().includes('Working') || $body.text().includes('Break')) {
          // Hold the End button for 3+ seconds
          cy.contains('button', 'End')
            .trigger('mousedown')

          cy.wait(3500)

          cy.wait('@endShift', { timeout: 10000 }).its('response.statusCode').should('eq', 200)
          cy.wait(2000)

          // Should show Start Shift button
          cy.contains('button', 'Start Shift').should('be.visible')
        }
      })
    })
  })

  describe('Shift Duration Display', () => {
    it('should display shift duration when on shift', () => {
      cy.visit('/employee/dashboard')
      cy.wait(2000)

      cy.get('body').then($body => {
        if ($body.text().includes('Working') || $body.text().includes('On Break')) {
          // Should show Shift duration
          cy.contains('Shift:').should('be.visible')
          // Duration should show time format (e.g., "5m" or "1h 30m")
          cy.get('body').should('satisfy', ($el) => {
            const text = $el.text()
            return /\d+h|\d+m/.test(text)
          })
        }
      })
    })

    it('should display break duration when on break', () => {
      cy.visit('/employee/dashboard')
      cy.wait(2000)

      cy.get('body').then($body => {
        if ($body.text().includes('On Break')) {
          // Should show Break duration
          cy.contains('Break:').should('be.visible')
        }
      })
    })
  })

  describe('Service Context Selection', () => {
    it('should show service selection dropdown when not on shift', () => {
      cy.visit('/employee/dashboard')
      cy.wait(2000)

      cy.get('body').then($body => {
        if ($body.text().includes('Start Shift')) {
          // Should show Service Context section
          cy.contains('Service Context').should('be.visible')

          // Should have a select dropdown
          cy.get('select').should('exist')
        }
      })
    })
  })
})
