describe('Client Portal - Complete Information Test', () => {
  before(() => {
    // Clear cookies and localStorage to start fresh
    cy.clearCookies()
    cy.clearLocalStorage()
  })

  beforeEach(() => {
    // Visit the root URL
    cy.visit('/')

    // Wait for the page to load
    cy.wait(2000)

    // Handle login if needed
    cy.get('body').then(($body) => {
      if ($body.find('input[name="username"]').length > 0) {
        // Login form is present, perform login
        cy.log('Logging in as kamran')
        cy.get('input[name="username"]').clear().type('kamran')
        cy.get('input[name="password"]').clear().type('kamran123')
        cy.get('button[type="submit"]').click()

        // Wait for login to complete
        cy.wait(5000)
      }
    })

    // Ensure we end up on a client page
    cy.url().then((currentUrl) => {
      if (!currentUrl.includes('/client/')) {
        cy.visit('/client/portal')
        cy.wait(3000)
      }
    })
  })

  it('should display complete client information across all pages', () => {
    // Test Overview/Portal Page
    cy.log('Testing Overview Page')

    // Check that we're on the client portal
    cy.contains('Chronogrid').should('be.visible')

    // Verify client name is displayed
    cy.get('h1').should('contain', 'Chronogrid')

    // Check overview cards are displayed
    cy.contains('Team Size').should('be.visible')
    cy.contains('Active Services').should('be.visible')
    cy.contains('Documents').should('be.visible')
    cy.contains('Invoices').should('be.visible')

    // Check contract information section
    cy.contains('Contract Information').should('be.visible')

    // Check services section
    cy.contains('Your Services').should('be.visible')

    // Test Documents Page
    cy.log('Testing Documents Page')

    // Navigate to Documents
    cy.contains('Documents').click()
    cy.url().should('include', '/client/documents')

    // Check documents page header
    cy.get('h1').should('contain', 'Documents')
    cy.contains('Your project documents and files').should('be.visible')

    // Check if documents are loaded (either documents exist or empty state)
    cy.get('body').then(($body) => {
      if ($body.find('[data-testid="document-item"]').length > 0) {
        // Documents exist - verify document information
        cy.get('[data-testid="document-item"]').first().within(() => {
          cy.get('.font-semibold').should('exist') // Document name
          cy.contains('Uploaded:').should('be.visible') // Upload date
        })
      } else {
        // No documents - check empty state
        cy.contains('No documents available').should('be.visible')
      }
    })

    // Test Invoices Page
    cy.log('Testing Invoices Page')

    // Navigate to Invoices
    cy.contains('Invoices').click()
    cy.url().should('include', '/client/invoices')

    // Check invoices page header
    cy.get('h1').should('contain', 'Invoices')
    cy.contains('Your billing history and payment information').should('be.visible')

    // Check if invoices are loaded (either invoices exist or empty state)
    cy.get('body').then(($body) => {
      if ($body.find('[data-testid="invoice-item"]').length > 0) {
        // Invoices exist - verify invoice information
        cy.get('[data-testid="invoice-item"]').first().within(() => {
          cy.get('.font-semibold').should('exist') // Invoice number
          cy.contains('Issued:').should('be.visible') // Issue date
        })

        // Check summary cards
        cy.contains('Total Billed').should('be.visible')
        cy.contains('Paid').should('be.visible')
        cy.contains('Pending').should('be.visible')
        cy.contains('Overdue').should('be.visible')
      } else {
        // No invoices - check empty state
        cy.contains('No invoices yet').should('be.visible')
      }
    })

    // Test Profile Page
    cy.log('Testing Profile Page')

    // Navigate to Profile
    cy.contains('Profile').click()
    cy.url().should('include', '/client/profile')

    // Check profile page header
    cy.get('h1').should('contain', 'Profile')
    cy.contains('Your account information and client access').should('be.visible')

    // Check personal information section
    cy.contains('Personal Information').should('be.visible')
    cy.contains('John Smith').should('be.visible') // User's full name
    cy.contains('@kamran').should('be.visible') // Username
    cy.contains('Client').should('be.visible') // Role badge

    // Check client access section
    cy.contains('Client Access').should('be.visible')
    cy.contains('Clients you have access to').should('be.visible')

    // Check account status section
    cy.contains('Account Status').should('be.visible')
    cy.contains('Account Active').should('be.visible')
    cy.contains('Client Role').should('be.visible')
    cy.contains('Read-only access').should('be.visible')

    // Go back to Overview to test navigation consistency
    cy.log('Testing Navigation Back to Overview')

    cy.contains('Overview').click()
    cy.url().should('include', '/client/portal')
    cy.contains('Chronogrid').should('be.visible')
  })

  it('should show proper navigation and client information in sidebar', () => {
    // Check sidebar navigation
    cy.contains('Client Portal').should('be.visible')

    // Check navigation items
    cy.contains('Overview').should('be.visible')
    cy.contains('Documents').should('be.visible')
    cy.contains('Invoices').should('be.visible')
    cy.contains('Profile').should('be.visible')

    // Check current client section
    cy.contains('Current Client').should('be.visible')
    cy.contains('Chronogrid').should('be.visible')
    cy.contains('You have read-only access').should('be.visible')

    // Check user section
    cy.contains('John Smith').should('be.visible')
    cy.contains('Client Role').should('be.visible')

    // Check logout button exists
    cy.get('[title="Sign out"]').should('be.visible')
  })

  it('should display client data properly on overview page', () => {
    // Wait for data to load
    cy.wait(3000)

    // Check client header information
    cy.get('h1').should('contain', 'Chronogrid')

    // Check status badges
    cy.get('body').should('contain', 'active') // Status badge

    // Check overview cards have numbers
    cy.get('body').then(($body) => {
      const cardText = $body.text()

      // Verify overview cards show data (numbers should be visible)
      expect(cardText).to.include('Team Size')
      expect(cardText).to.include('Active Services')
      expect(cardText).to.include('Documents')
      expect(cardText).to.include('Invoices')
    })

    // Check contract information exists
    cy.contains('Contract Information').should('be.visible')

    // Check services section exists
    cy.contains('Your Services').should('be.visible')
  })

  it('should handle mobile navigation properly', () => {
    // Test mobile view
    cy.viewport(375, 667) // iPhone SE size

    // Check mobile menu button exists
    cy.get('[data-testid="mobile-menu-button"]').should('be.visible')

    // Click mobile menu
    cy.get('[data-testid="mobile-menu-button"]').click()

    // Check mobile navigation items
    cy.contains('Overview').should('be.visible')
    cy.contains('Documents').should('be.visible')
    cy.contains('Invoices').should('be.visible')
    cy.contains('Profile').should('be.visible')

    // Check mobile user info
    cy.contains('John Smith').should('be.visible')
    cy.contains('Chronogrid').should('be.visible')

    // Close mobile menu
    cy.get('[data-testid="mobile-menu-close"]').click()

    // Return to desktop view
    cy.viewport(1280, 720)
  })

  it('should test logout functionality', () => {
    // Click logout button
    cy.get('[title="Sign out"]').click()

    // Should redirect to login page
    cy.url().should('include', '/login')

    // Should show login form
    cy.get('input[name="username"]').should('be.visible')
    cy.get('input[name="password"]').should('be.visible')
  })

  it('should verify read-only access restrictions', () => {
    // Verify no edit buttons or forms are present
    cy.get('body').should('not.contain', 'Edit')
    cy.get('body').should('not.contain', 'Add')
    cy.get('body').should('not.contain', 'Create')
    cy.get('body').should('not.contain', 'Delete')

    // Check that read-only access is mentioned
    cy.contains('read-only access').should('be.visible')

    // Go to profile page and verify client role
    cy.contains('Profile').click()
    cy.contains('Client Role').should('be.visible')
    cy.contains('Read-only access').should('be.visible')
  })

  it('should load and display actual client data', () => {
    // Wait for all data to load
    cy.wait(5000)

    // Check that we're not seeing loading states or empty placeholders
    cy.get('body').should('not.contain', 'Loading...')
    cy.get('body').should('not.contain', 'coming soon')
    cy.get('body').should('not.contain', 'Welcome')

    // Verify we have actual client name (not placeholder)
    cy.get('h1').should('contain', 'Chronogrid')

    // Check all navigation pages for actual content
    const pages = [
      { name: 'Documents', url: '/client/documents' },
      { name: 'Invoices', url: '/client/invoices' },
      { name: 'Profile', url: '/client/profile' }
    ]

    pages.forEach((page) => {
      cy.contains(page.name).click()
      cy.url().should('include', page.url)

      // Verify page loads without errors
      cy.get('h1').should('be.visible')

      // Verify no error messages
      cy.get('body').should('not.contain', 'Error')
      cy.get('body').should('not.contain', 'Failed to load')

      cy.wait(1000)
    })
  })
})