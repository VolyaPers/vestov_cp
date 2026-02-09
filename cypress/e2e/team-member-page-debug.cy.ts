describe('Team Member Page Debug', () => {
  beforeEach(() => {
    // Clear cookies and local storage before each test
    cy.clearCookies()
    cy.clearLocalStorage()

    // Visit home page
    cy.visit('http://localhost:5173/')
    cy.wait(1000)

    // Login as admin
    cy.get('input[placeholder="Enter your username"]', { timeout: 10000 }).should('be.visible').clear().type('admin')
    cy.get('input[placeholder="Enter your password"]').should('be.visible').clear().type('admin123')
    cy.contains('Sign In').click()

    // Wait for redirect to admin dashboard
    cy.url({ timeout: 10000 }).should('include', '/admin')
    cy.wait(2000)
  })

  it('should load team member detail page successfully', () => {
    // Navigate DIRECTLY to team member detail page to avoid client-side routing issues
    cy.visit('http://localhost:5173/admin/team/11', {
      failOnStatusCode: false,
      onBeforeLoad(win) {
        cy.stub(win.console, 'error').as('consoleError')
        cy.stub(win.console, 'log').as('consoleLog')
      }
    })

    // Wait for page to load
    cy.wait(5000)

    // Check console errors FIRST
    cy.get('@consoleError').then((error: any) => {
      const calls = error.getCalls()
      if (calls.length > 0) {
        cy.log(`Found ${calls.length} console errors`)
        calls.forEach((call: any) => {
          cy.log('Error:', JSON.stringify(call.args))
        })
      } else {
        cy.log('No console errors found')
      }
    })

    // Check console logs
    cy.get('@consoleLog').then((log: any) => {
      const calls = log.getCalls()
      cy.log(`Found ${calls.length} console.log calls`)
      calls.slice(-10).forEach((call: any) => {
        cy.log('Console Log:', JSON.stringify(call.args).substring(0, 300))
      })
    })

    // Take a screenshot
    cy.screenshot('team-member-detail-page')

    // Check if page has any visible content
    cy.get('body').then(($body) => {
      const text = $body.text()
      const html = $body.html()
      cy.log('Page text length:', text.length)
      cy.log('Page HTML length:', html.length)
      cy.log('Page text preview:', text.substring(0, 200))

      // Check if it's a white screen (minimal content)
      if (text.trim().length < 50) {
        cy.log('WARNING: Page appears to be blank/white screen')
        throw new Error('Page is blank - white screen detected')
      } else {
        cy.log('SUCCESS: Page has content')
      }
    })

    // Verify specific team member detail content is visible
    cy.contains('Eduardo Cerato', { timeout: 5000 }).should('be.visible')
    cy.contains('Back to Team').should('be.visible')
    cy.contains('Full-Stack Developer').should('be.visible')
  })
})
