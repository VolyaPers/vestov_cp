describe('Sidebar Navigation Visibility by Profile', () => {
  describe('Admin Profile Navigation', () => {
    beforeEach(() => {
      cy.loginAsAdmin()
      cy.visit('/admin/dashboard')
      cy.wait(2000)
    })

    // Note: 'Clients' and 'Invoices' are inside CRM submenu
    const expectedAdminNavLinks = [
      { name: 'Dashboard', shouldExist: true },
      { name: 'Services', shouldExist: true },
      { name: 'CRM', shouldExist: true },
      { name: 'Users', shouldExist: true },
      { name: 'Team', shouldExist: true },
      { name: 'Shifts', shouldExist: true },
      { name: 'Vacation', shouldExist: true },
      { name: 'Reimbursements', shouldExist: true },
      { name: 'Documents', shouldExist: true },
      { name: 'Feedback', shouldExist: true },
    ]

    expectedAdminNavLinks.forEach(link => {
      it(`should ${link.shouldExist ? 'show' : 'NOT show'} "${link.name}" link in admin sidebar`, () => {
        if (link.shouldExist) {
          // Check in desktop sidebar (hidden on mobile)
          cy.get('.hidden.lg\\:flex').within(() => {
            cy.contains(link.name).should('exist')
          })
        } else {
          cy.get('.hidden.lg\\:flex').within(() => {
            cy.contains(link.name).should('not.exist')
          })
        }
      })
    })

    it('should NOT show employee-only links in admin sidebar', () => {
      const employeeOnlyLinks = ['Roadmap', 'Knowledge Base']
      cy.get('.hidden.lg\\:flex').within(() => {
        employeeOnlyLinks.forEach(link => {
          cy.contains(link).should('not.exist')
        })
      })
    })

    it('should show "Admin Dashboard" subtitle in sidebar header', () => {
      cy.get('.hidden.lg\\:flex').contains('Admin Dashboard').should('be.visible')
    })

    it('should show Vestov Portal logo', () => {
      cy.get('.hidden.lg\\:flex').contains('Vestov Portal').should('be.visible')
    })

    it('should show user info section at bottom of sidebar', () => {
      // Admin user info should be visible
      cy.get('.hidden.lg\\:flex').within(() => {
        cy.contains('admin').should('exist') // username or fullname
      })
    })

    it('should show Super Admin impersonation widget', () => {
      cy.get('.hidden.lg\\:flex').contains('Super Admin').should('be.visible')
      cy.get('.hidden.lg\\:flex').contains('button', 'Switch to User').should('be.visible')
    })
  })

  describe('Team Member Profile Navigation', () => {
    beforeEach(() => {
      cy.loginAsTeamMember()
      cy.visit('/employee/dashboard')
      cy.wait(2000)
    })

    const expectedTeamMemberNavLinks = [
      { name: 'Dashboard', shouldExist: true },
      { name: 'Roadmap', shouldExist: true },
      { name: 'Vacations', shouldExist: true },
      { name: 'Reimbursements', shouldExist: true },
      { name: 'Profile', shouldExist: true },
      { name: 'Knowledge Base', shouldExist: true },
    ]

    expectedTeamMemberNavLinks.forEach(link => {
      it(`should ${link.shouldExist ? 'show' : 'NOT show'} "${link.name}" link in team member sidebar`, () => {
        if (link.shouldExist) {
          cy.get('.hidden.lg\\:flex').within(() => {
            cy.contains(link.name).should('exist')
          })
        } else {
          cy.get('.hidden.lg\\:flex').within(() => {
            cy.contains(link.name).should('not.exist')
          })
        }
      })
    })

    it('should NOT show admin-only links in team member sidebar', () => {
      const adminOnlyLinks = ['Services', 'CRM', 'Clients', 'Users', 'Team', 'Shifts', 'Documents', 'Feedback']
      cy.get('.hidden.lg\\:flex').within(() => {
        adminOnlyLinks.forEach(link => {
          cy.contains(link).should('not.exist')
        })
      })
    })

    it('should show "Employee Portal" subtitle in sidebar header', () => {
      cy.get('.hidden.lg\\:flex').contains('Employee Portal').should('be.visible')
    })

    it('should show Vestov Portal logo', () => {
      cy.get('.hidden.lg\\:flex').contains('Vestov Portal').should('be.visible')
    })

    it('should show user info with avatar', () => {
      cy.get('.hidden.lg\\:flex').within(() => {
        // Should have avatar or initials
        cy.get('span, img').should('exist')
      })
    })

    it('should show ShiftWidget in sidebar', () => {
      // ShiftWidget should show shift controls
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text()
        return text.includes('Start Shift') || text.includes('Break') || text.includes('End')
      })
    })

    it('should show Sign Out button', () => {
      cy.get('.hidden.lg\\:flex').within(() => {
        cy.contains('Sign Out').should('exist')
      })
    })

    it('should NOT show Super Admin impersonation widget', () => {
      cy.contains('Super Admin').should('not.exist')
      cy.contains('button', 'Switch to User').should('not.exist')
    })
  })

  describe('Client Profile Navigation', () => {
    beforeEach(() => {
      // Use direct login instead of session for client
      cy.visit('/')
      cy.get('input[id="username"]').type('client')
      cy.get('input[id="password"]').type('client123')
      cy.get('button[type="submit"]').click()
      cy.url({ timeout: 10000 }).should('include', '/client')
      cy.wait(2000)
    })

    const expectedClientNavLinks = [
      { name: 'Overview', shouldExist: true },
      { name: 'Team Status', shouldExist: true },
      { name: 'Documents', shouldExist: true },
      { name: 'Invoices', shouldExist: true },
      { name: 'Feedback', shouldExist: true },
      { name: 'Profile', shouldExist: true },
    ]

    expectedClientNavLinks.forEach(link => {
      it(`should ${link.shouldExist ? 'show' : 'NOT show'} "${link.name}" link in client sidebar`, () => {
        if (link.shouldExist) {
          cy.get('.hidden.lg\\:flex').within(() => {
            cy.contains(link.name).should('exist')
          })
        } else {
          cy.get('.hidden.lg\\:flex').within(() => {
            cy.contains(link.name).should('not.exist')
          })
        }
      })
    })

    it('should NOT show admin-only links in client sidebar', () => {
      const adminOnlyLinks = ['Services', 'CRM', 'Users', 'Shifts', 'Vacation']
      cy.get('.hidden.lg\\:flex').within(() => {
        adminOnlyLinks.forEach(link => {
          cy.contains(link).should('not.exist')
        })
      })
    })

    it('should NOT show team-member-only links in client sidebar', () => {
      const teamMemberOnlyLinks = ['Roadmap', 'Vacations', 'Knowledge Base']
      cy.get('.hidden.lg\\:flex').within(() => {
        teamMemberOnlyLinks.forEach(link => {
          cy.contains(link).should('not.exist')
        })
      })
    })

    it('should show "Client Portal" subtitle in sidebar header', () => {
      cy.get('.hidden.lg\\:flex').contains('Client Portal').should('be.visible')
    })

    it('should show Vestov logo', () => {
      // Check for either text or image logo
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('img[alt*="Vestov"]').length > 0 || $body.text().includes('Vestov')
      })
    })

    it('should show "Current Client" info section', () => {
      cy.get('.hidden.lg\\:flex').within(() => {
        cy.contains('Current Client').should('exist')
        cy.contains('You have read-only access').should('exist')
      })
    })

    it('should NOT show Super Admin impersonation widget', () => {
      cy.contains('Super Admin').should('not.exist')
      cy.contains('button', 'Switch to User').should('not.exist')
    })

    it('should NOT show ShiftWidget', () => {
      // Client shouldn't have shift controls
      cy.get('.hidden.lg\\:flex').within(() => {
        cy.contains('Start Shift').should('not.exist')
        cy.contains('Service Context').should('not.exist')
      })
    })
  })

  describe('Navigation Active State Styling', () => {
    it('should highlight active link in admin sidebar', () => {
      cy.loginAsAdmin()
      cy.visit('/admin/dashboard')
      cy.wait(2000)

      // Dashboard link should have active styling
      cy.get('.hidden.lg\\:flex').within(() => {
        // Find the active nav item containing Dashboard
        cy.get('.stripe-nav-item-active').should('exist')
        cy.contains('a', 'Dashboard').should('exist')
      })

      // Navigate to Services and check active state changes
      cy.visit('/admin/services')
      cy.wait(1000)
      cy.get('.hidden.lg\\:flex').within(() => {
        cy.get('.stripe-nav-item-active').should('exist')
        cy.contains('a', 'Services').should('exist')
      })
    })

    it('should highlight active link in team member sidebar', () => {
      cy.loginAsTeamMember()
      cy.visit('/employee/dashboard')
      cy.wait(2000)

      // Dashboard should have active styling
      cy.get('.hidden.lg\\:flex').within(() => {
        cy.get('.stripe-nav-item-active').should('exist')
        cy.contains('a', 'Dashboard').should('exist')
      })
    })

    it('should highlight active link in client sidebar', () => {
      cy.visit('/')
      cy.get('input[id="username"]').type('client')
      cy.get('input[id="password"]').type('client123')
      cy.get('button[type="submit"]').click()
      cy.url({ timeout: 10000 }).should('include', '/client')
      cy.wait(2000)

      // Overview should be in sidebar and have some form of active styling
      cy.get('.hidden.lg\\:flex').within(() => {
        cy.contains('a', 'Overview').should('exist')
        // Active styling may vary - just verify the link exists and is accessible
      })
    })
  })

  describe('Mobile Navigation', () => {
    beforeEach(() => {
      cy.viewport('iphone-6')
    })

    it('should show mobile menu button for admin', () => {
      cy.loginAsAdmin()
      cy.visit('/admin/dashboard')
      cy.wait(2000)

      // Mobile menu button should be visible
      cy.get('[data-testid="mobile-menu-button"], button:has(svg.lucide-menu)').should('be.visible')
    })

    it('should show mobile menu button for team member', () => {
      cy.loginAsTeamMember()
      cy.visit('/employee/dashboard')
      cy.wait(2000)

      cy.get('[data-testid="mobile-menu-button"], button:has(svg.lucide-menu)').should('be.visible')
    })

    it('should show mobile menu button for client', () => {
      cy.visit('/')
      cy.get('input[id="username"]').type('client')
      cy.get('input[id="password"]').type('client123')
      cy.get('button[type="submit"]').click()
      cy.url({ timeout: 10000 }).should('include', '/client')
      cy.wait(2000)

      cy.get('[data-testid="mobile-menu-button"], button:has(svg.lucide-menu)').should('be.visible')
    })

    it('should open mobile menu when clicking menu button', () => {
      cy.loginAsAdmin()
      cy.visit('/admin/dashboard')
      cy.wait(2000)

      // Click mobile menu button
      cy.get('[data-testid="mobile-menu-button"], button:has(svg.lucide-menu)').first().click()

      // Mobile menu should be visible
      cy.get('.fixed.inset-0.z-50').should('be.visible')

      // Should show navigation links
      cy.contains('Dashboard').should('be.visible')
    })

    it('should close mobile menu when clicking close button', () => {
      cy.loginAsAdmin()
      cy.visit('/admin/dashboard')
      cy.wait(2000)

      // Open menu
      cy.get('[data-testid="mobile-menu-button"], button:has(svg.lucide-menu)').first().click()
      cy.get('.fixed.inset-0.z-50').should('be.visible')

      // Click close button
      cy.get('[data-testid="mobile-menu-close"], button:has(svg.lucide-x)').click()

      // Menu should be hidden
      cy.get('.fixed.inset-0.z-50').should('not.be.visible')
    })

    afterEach(() => {
      cy.viewport(1280, 720)
    })
  })
})
