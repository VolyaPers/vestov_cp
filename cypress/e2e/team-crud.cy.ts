describe('Team Member CRUD Operations', () => {
  beforeEach(() => {
    cy.loginAsAdmin()
  })

  it('should display team members page with CRUD functionality', () => {
    cy.visit('/admin/team')

    // Wait for page to load
    cy.contains('Team Overview', { timeout: 10000 }).should('be.visible')

    // Should have the Add Team Member button
    cy.contains('button', 'Add Team Member').should('be.visible')
  })

  it('should open add team member modal', () => {
    cy.visit('/admin/team')
    cy.contains('Team Overview', { timeout: 10000 }).should('be.visible')

    // Click Add Team Member button
    cy.contains('button', 'Add Team Member').click()

    // Modal should open
    cy.contains('Add New Team Member').should('be.visible')
    cy.get('input[id="name"]').should('be.visible')
    cy.get('input[id="email"]').should('be.visible')
    cy.get('input[id="role"]').should('be.visible')
  })

  it('should show edit and delete buttons on hover for team members', () => {
    cy.visit('/admin/team')
    cy.contains('Team Overview', { timeout: 10000 }).should('be.visible')

    // Wait a bit for any team members to load
    cy.wait(2000)

    // Look for team member cards and check if edit/delete buttons appear on hover
    cy.get('body').then(($body) => {
      if ($body.find('[data-testid="member-card"]').length > 0) {
        // If there are team member cards, test hover functionality
        cy.get('[data-testid="member-card"]').first().trigger('mouseover')
        cy.get('button[title="Edit team member"]').should('exist')
        cy.get('button[title="Delete team member"]').should('exist')
      } else {
        // If no team members exist, just log this
        cy.log('No team members found - skipping hover test')
      }
    })
  })

  it('should create a new team member', () => {
    cy.visit('/admin/team')
    cy.contains('Team Overview', { timeout: 10000 }).should('be.visible')

    // Open add modal
    cy.contains('button', 'Add Team Member').click()
    cy.contains('Add New Team Member').should('be.visible')

    // Fill out the form
    cy.get('input[id="name"]').type('Test User')
    cy.get('input[id="email"]').type('test@example.com')
    cy.get('input[id="role"]').type('Test Developer')
    cy.get('input[id="phone"]').type('123-456-7890')
    cy.get('input[id="location"]').type('Test City')

    // Submit the form
    cy.contains('button', 'Add Team Member').click()

    // Should close modal and refresh data
    cy.contains('Add New Team Member').should('not.exist')

    // The new team member might appear in the list
    // Note: This depends on server response and data refresh
  })

  it('should handle form validation', () => {
    cy.visit('/admin/team')
    cy.contains('Team Overview', { timeout: 10000 }).should('be.visible')

    // Open add modal
    cy.contains('button', 'Add Team Member').click()
    cy.contains('Add New Team Member').should('be.visible')

    // Try to submit without required fields
    cy.contains('button', 'Add Team Member').should('be.disabled')

    // Fill only name
    cy.get('input[id="name"]').type('Test User')
    cy.contains('button', 'Add Team Member').should('be.disabled')

    // Add email
    cy.get('input[id="email"]').type('test@example.com')
    cy.contains('button', 'Add Team Member').should('be.disabled')

    // Add role - now button should be enabled
    cy.get('input[id="role"]').type('Test Developer')
    cy.contains('button', 'Add Team Member').should('not.be.disabled')
  })
})