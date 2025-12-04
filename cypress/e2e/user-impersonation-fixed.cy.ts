describe('User Impersonation Flow', () => {
  beforeEach(() => {
    // Clear any existing session
    cy.clearCookies()
    cy.clearLocalStorage()

    // Capture console logs
    cy.on('window:before:load', (win) => {
      cy.spy(win.console, 'log').as('consoleLog')
      cy.spy(win.console, 'error').as('consoleError')
    })
  })

  it('should allow admin to impersonate client user and see client portal', () => {
    // Step 1: Login as admin
    cy.visit('http://localhost:5173')
    cy.get('input[type="text"]').type('admin')
    cy.get('input[type="password"]').type('admin123')
    cy.get('button[type="submit"]').click()

    // Step 2: Verify we're on admin dashboard
    cy.url().should('include', '/admin/dashboard')
    cy.get('main').contains('Dashboard').should('be.visible')

    // Step 3: Click on "Switch to User" button
    cy.contains('button', 'Switch to User').click({ multiple: true, force: true })

    // Step 4: Select John Smith (client user)
    cy.wait(1000)
    cy.contains(/john.*smith/i).click({ force: true })

    // Step 5: Wait for redirect to client portal
    cy.url({ timeout: 15000 }).should('match', /\/client\/portal/)
    cy.wait(5000) // Wait for ClientLayout to load and render

    // Step 6: Verify client portal is visible
    cy.get('main', { timeout: 10000 }).should('be.visible')
    cy.contains(/Client Portal|Overview|TechCorp/i, { timeout: 10000 }).should('be.visible')

    // Step 7: Stop impersonation
    cy.contains('button', /Stop/i, { timeout: 10000 }).should('be.visible').click({ force: true })

    // Step 8: Verify we're back on admin dashboard
    cy.url({ timeout: 10000 }).should('include', '/admin/dashboard')
    cy.get('main').contains('Dashboard').should('be.visible')
  })

  it('should allow admin to impersonate team member and see employee portal', () => {
    // Step 1: Login as admin
    cy.visit('http://localhost:5173')
    cy.get('input[type="text"]').type('admin')
    cy.get('input[type="password"]').type('admin123')
    cy.get('button[type="submit"]').click()

    // Step 2: Verify we're on admin dashboard
    cy.url().should('include', '/admin/dashboard')
    cy.get('main').contains('Dashboard').should('be.visible')

    // Step 3: Click on "Switch to User" button
    cy.contains('button', 'Switch to User').click({ multiple: true, force: true })

    // Step 4: Wait for user list to appear and select Eduardo (team member)
    cy.wait(1000) // Wait for dropdown to render
    cy.contains(/eduardo/i).click({ force: true })

    // Step 5: Wait for redirect and verify we're on employee portal
    cy.url({ timeout: 10000 }).should('include', '/employee/dashboard')

    // Step 6: Verify employee UI is visible
    cy.get('main', { timeout: 10000 }).should('be.visible').should('not.be.empty')

    // Step 7: Stop impersonation
    cy.contains('Stop').click({ force: true })

    // Step 8: Verify we're back on admin dashboard
    cy.url({ timeout: 10000 }).should('include', '/admin/dashboard')
    cy.get('main').contains('Dashboard').should('be.visible')
  })

  it('should not show white screen after impersonation', () => {
    // Login as admin
    cy.visit('http://localhost:5173')
    cy.get('input[type="text"]').type('admin')
    cy.get('input[type="password"]').type('admin123')
    cy.get('button[type="submit"]').click()

    // Impersonate John Smith (client)
    cy.contains('button', 'Switch to User').click({ multiple: true, force: true })
    cy.wait(1000) // Wait for dropdown to render
    cy.contains(/john.*smith/i).click({ force: true })

    // Wait for client portal to load
    cy.url({ timeout: 10000 }).should('match', /\/client\/portal/)
    cy.wait(2000) // Wait for potential redirect to /client/portal/1

    // Verify page is not empty/white - main content area exists and is visible
    cy.get('main', { timeout: 10000 }).should('exist').should('be.visible')

    // Verify there's actual visible content (not just loading spinner or white screen)
    cy.contains(/Client Portal|Overview|TechCorp|Documents/i, { timeout: 10000 }).should('be.visible')

    // Take screenshot for visual verification
    cy.screenshot('client-portal-after-impersonation')
  })
})
