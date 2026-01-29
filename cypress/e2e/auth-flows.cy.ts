describe('Authentication Flows', () => {
  describe('Login', () => {
    beforeEach(() => {
      // Clear any existing sessions
      cy.clearCookies()
      cy.clearLocalStorage()
    })

    it('should login as admin successfully', () => {
      cy.visit('/')
      cy.get('input[id="username"]').type('admin')
      cy.get('input[id="password"]').type('admin123')
      cy.get('button[type="submit"]').click()

      // Should redirect to admin dashboard
      cy.url({ timeout: 10000 }).should('include', '/admin/dashboard')
      // Check that dashboard content is present (visible in main area)
      cy.contains('Dashboard', { timeout: 10000 }).should('exist')
    })

    it('should login as team member successfully', () => {
      cy.visit('/')
      cy.get('input[id="username"]').type('eduardo')
      cy.get('input[id="password"]').type('eduardo123')
      cy.get('button[type="submit"]').click()

      // Should redirect to employee dashboard
      cy.url({ timeout: 10000 }).should('include', '/employee')
      // Check that dashboard content is present
      cy.contains('Dashboard', { timeout: 10000 }).should('exist')
    })

    it('should login as client successfully', () => {
      cy.visit('/')
      cy.get('input[id="username"]').type('client')
      cy.get('input[id="password"]').type('client123')
      cy.get('button[type="submit"]').click()

      // Should redirect to client dashboard
      cy.url({ timeout: 10000 }).should('satisfy', (url: string) => {
        return url.includes('/client') || url.includes('/dashboard')
      })
    })

    it('should show error for invalid credentials', () => {
      cy.visit('/')
      cy.get('input[id="username"]').type('invaliduser')
      cy.get('input[id="password"]').type('wrongpassword')
      cy.get('button[type="submit"]').click()

      // Should show error message
      cy.get('[role="alert"]', { timeout: 5000 }).should('be.visible')
      cy.url().should('not.include', '/dashboard')
    })

    it('should redirect to correct dashboard based on role', () => {
      // Test admin redirect
      cy.visit('/')
      cy.get('input[id="username"]').type('admin')
      cy.get('input[id="password"]').type('admin123')
      cy.get('button[type="submit"]').click()
      cy.url({ timeout: 10000 }).should('include', '/admin')

      // Clear and test team member redirect
      cy.clearCookies()
      cy.visit('/')
      cy.get('input[id="username"]').type('eduardo')
      cy.get('input[id="password"]').type('eduardo123')
      cy.get('button[type="submit"]').click()
      cy.url({ timeout: 10000 }).should('include', '/employee')
    })
  })

  describe('Logout', () => {
    it('should logout admin successfully', () => {
      cy.loginAsAdmin()
      cy.visit('/admin/dashboard')
      cy.contains('Dashboard', { timeout: 10000 }).should('exist')

      // Click logout button
      cy.logout()

      // Should be back at login page
      cy.url().should('eq', Cypress.config().baseUrl + '/')
      cy.contains('Sign in to your account').should('be.visible')
    })

    it('should logout team member successfully', () => {
      cy.loginAsTeamMember()
      cy.visit('/employee/dashboard')
      cy.url({ timeout: 10000 }).should('include', '/employee')

      // Click logout button
      cy.logout()

      // Should be back at login page
      cy.url().should('eq', Cypress.config().baseUrl + '/')
      cy.contains('Sign in to your account').should('be.visible')
    })
  })

  describe('User Creation via Admin Panel', () => {
    beforeEach(() => {
      cy.intercept('POST', '/api/users').as('createUser')
    })

    it('should create new admin user via admin panel', () => {
      const timestamp = Date.now()
      const newUser = {
        username: `testadmin${timestamp}`,
        password: 'TestPass123!',
        fullName: 'Test Admin User',
        email: `testadmin${timestamp}@test.com`,
        role: 'admin'
      }

      // Login fresh to ensure we have valid session
      cy.visit('/')
      cy.get('input[id="username"]').type('admin')
      cy.get('input[id="password"]').type('admin123')
      cy.get('button[type="submit"]').click()
      cy.url({ timeout: 10000 }).should('include', '/admin')

      cy.visit('/admin/users')
      cy.contains('User', { timeout: 10000 }).should('exist')

      // Click create user button
      cy.contains('button', 'Create User').click()

      // Fill the form
      cy.get('input[id="userUsername"]').type(newUser.username)
      cy.get('input[id="userPassword"]').type(newUser.password)
      cy.get('input[id="userFullName"]').type(newUser.fullName)
      cy.get('input[id="userEmail"]').type(newUser.email)

      // Select admin role - click dropdown to open, then select option
      cy.get('.fixed.z-50.flex.items-center.justify-center .stripe-card').find('button').contains(/client/i).first().click()
      // Wait for dropdown and click Admin option (look for the non-button Admin text)
      cy.wait(500) // Wait for dropdown to appear
      cy.contains('div', 'Admin').click({ force: true })

      // Submit - click the submit button inside the dialog
      cy.get('.fixed.z-50.flex.items-center.justify-center .stripe-card').contains('button', 'Create User').click({ force: true })

      // Wait for API call
      cy.wait('@createUser').its('response.statusCode').should('be.oneOf', [200, 201])

      // Dialog should close
      cy.get('.fixed.z-50.flex.items-center.justify-center .stripe-card').should('not.exist')

      // Verify user creation was successful (page shows user list)
      cy.contains('Users', { timeout: 10000 }).should('exist')
    })

    it('should create new team member user via admin panel', () => {
      const timestamp = Date.now()
      const newUser = {
        username: `testmember${timestamp}`,
        password: 'TestPass123!',
        fullName: 'Test Team Member',
        email: `testmember${timestamp}@test.com`,
        role: 'team_member'
      }

      // Login fresh to ensure we have valid session
      cy.visit('/')
      cy.get('input[id="username"]').type('admin')
      cy.get('input[id="password"]').type('admin123')
      cy.get('button[type="submit"]').click()
      cy.url({ timeout: 10000 }).should('include', '/admin')

      cy.visit('/admin/users')
      cy.contains('User', { timeout: 10000 }).should('exist')

      // Click create user button
      cy.contains('button', 'Create User').click()

      // Fill the form
      cy.get('input[id="userUsername"]').type(newUser.username)
      cy.get('input[id="userPassword"]').type(newUser.password)
      cy.get('input[id="userFullName"]').type(newUser.fullName)
      cy.get('input[id="userEmail"]').type(newUser.email)

      // Select team member role - click dropdown to open, then select option
      cy.get('.fixed.z-50.flex.items-center.justify-center .stripe-card').find('button').contains(/client/i).first().click()
      // Wait for dropdown and click Team Member option
      cy.wait(500) // Wait for dropdown to appear
      cy.contains('div', 'Team Member').click({ force: true })

      // Team member might need to select an existing team member or create new one
      // For now, just try to submit and see if it works without linking
      cy.get('body').then(($body) => {
        // If there's a team member select, pick the first available one
        if ($body.find('select:contains("Select team member")').length > 0 ||
            $body.find('[data-testid="team-member-select"]').length > 0) {
          cy.get('select').last().select(1) // Select first available option
        }
      })

      // Submit - click the submit button inside the dialog
      cy.get('.fixed.z-50.flex.items-center.justify-center .stripe-card').contains('button', 'Create User').click({ force: true })

      // Wait for API call (may fail if team member linking is required)
      cy.wait('@createUser', { timeout: 10000 })

      // Verify user creation completed - dialog should close
      cy.get('.fixed.z-50.flex.items-center.justify-center .stripe-card').should('not.exist')

      // Verify we're back on the users page
      cy.contains('Users', { timeout: 10000 }).should('exist')
    })

    it('should create new client user via admin panel', () => {
      const timestamp = Date.now()
      const newUser = {
        username: `testclient${timestamp}`,
        password: 'TestPass123!',
        fullName: 'Test Client User',
        email: `testclient${timestamp}@test.com`,
        role: 'client'
      }

      // Login fresh to ensure we have valid session
      cy.visit('/')
      cy.get('input[id="username"]').type('admin')
      cy.get('input[id="password"]').type('admin123')
      cy.get('button[type="submit"]').click()
      cy.url({ timeout: 10000 }).should('include', '/admin')

      cy.visit('/admin/users')
      cy.contains('User', { timeout: 10000 }).should('exist')

      // Click create user button
      cy.contains('button', 'Create User').click()

      // Fill the form
      cy.get('input[id="userUsername"]').type(newUser.username)
      cy.get('input[id="userPassword"]').type(newUser.password)
      cy.get('input[id="userFullName"]').type(newUser.fullName)
      cy.get('input[id="userEmail"]').type(newUser.email)

      // Role is already client by default, but verify
      cy.get('.fixed.z-50.flex.items-center.justify-center .stripe-card').within(() => {
        cy.get('button').contains(/client/i).should('exist')
      })

      // Submit - click the submit button inside the dialog
      cy.get('.fixed.z-50.flex.items-center.justify-center .stripe-card').contains('button', 'Create User').click({ force: true })

      // Wait for API call
      cy.wait('@createUser').its('response.statusCode').should('be.oneOf', [200, 201])

      // Dialog should close
      cy.get('.fixed.z-50.flex.items-center.justify-center .stripe-card').should('not.exist')

      // Verify we're back on the users page
      cy.contains('Users', { timeout: 10000 }).should('exist')
    })
  })

  describe('User Self-Registration', () => {
    beforeEach(() => {
      cy.clearCookies()
      cy.clearLocalStorage()
      cy.intercept('POST', '/api/register').as('register')
    })

    it('should self-register as admin', () => {
      const timestamp = Date.now()
      const newUser = {
        firstName: 'SelfReg',
        lastName: `Admin${timestamp}`,
        email: `selfregadmin${timestamp}@test.com`,
        password: 'TestPass123!'
      }

      cy.visit('/')

      // Switch to Create Account mode
      cy.contains('button', 'Create Account').click()

      // Fill registration form
      cy.get('input[id="firstName"]').type(newUser.firstName)
      cy.get('input[id="lastName"]').type(newUser.lastName)
      cy.get('input[id="email"]').type(newUser.email)
      cy.get('input[id="new-password"]').type(newUser.password)

      // Select admin role
      cy.get('select[id="role"]').select('admin')

      // Submit
      cy.get('button[type="submit"]').click()

      // Wait for registration
      cy.wait('@register').its('response.statusCode').should('be.oneOf', [200, 201])

      // Should redirect to admin dashboard
      cy.url({ timeout: 15000 }).should('include', '/admin')
    })

    it('should self-register as team member', () => {
      const timestamp = Date.now()
      const newUser = {
        firstName: 'SelfReg',
        lastName: `Member${timestamp}`,
        email: `selfregmember${timestamp}@test.com`,
        password: 'TestPass123!'
      }

      cy.visit('/')

      // Switch to Create Account mode
      cy.contains('button', 'Create Account').click()

      // Fill registration form
      cy.get('input[id="firstName"]').type(newUser.firstName)
      cy.get('input[id="lastName"]').type(newUser.lastName)
      cy.get('input[id="email"]').type(newUser.email)
      cy.get('input[id="new-password"]').type(newUser.password)

      // Select team_member role
      cy.get('select[id="role"]').select('team_member')

      // Submit
      cy.get('button[type="submit"]').click()

      // Wait for registration
      cy.wait('@register').its('response.statusCode').should('be.oneOf', [200, 201])

      // Should redirect to employee dashboard
      cy.url({ timeout: 15000 }).should('include', '/employee')
    })

    it('should self-register as client', () => {
      const timestamp = Date.now()
      const newUser = {
        firstName: 'SelfReg',
        lastName: `Client${timestamp}`,
        email: `selfregclient${timestamp}@test.com`,
        password: 'TestPass123!'
      }

      cy.visit('/')

      // Switch to Create Account mode
      cy.contains('button', 'Create Account').click()

      // Fill registration form
      cy.get('input[id="firstName"]').type(newUser.firstName)
      cy.get('input[id="lastName"]').type(newUser.lastName)
      cy.get('input[id="email"]').type(newUser.email)
      cy.get('input[id="new-password"]').type(newUser.password)

      // Client is the default role, but explicitly select it
      cy.get('select[id="role"]').select('client')

      // Submit
      cy.get('button[type="submit"]').click()

      // Wait for registration
      cy.wait('@register').its('response.statusCode').should('be.oneOf', [200, 201])

      // Should redirect to client dashboard
      cy.url({ timeout: 15000 }).should('include', '/client')
    })
  })
})
