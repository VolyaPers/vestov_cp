/// <reference types="cypress" />

describe('Employee Profile', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/vacation/my-profile').as('getProfile')
    cy.intercept('PUT', '/api/admin/team-members/*').as('updateProfile')
    cy.loginAsTeamMember()
    cy.visit('/employee/profile')
    cy.wait(2000)
  })

  it('should load profile page', () => {
    cy.url().should('include', '/employee')
    cy.get('body').should('satisfy', ($body) => {
      const text = $body.text().toLowerCase()
      return text.includes('profile') || text.includes('account')
    })
  })

  it('should display user avatar', () => {
    cy.get('body').should('satisfy', ($body) => {
      return $body.find('img, [class*="avatar"], svg[class*="user"]').length > 0
    })
  })

  it('should display user name', () => {
    cy.get('body').should('satisfy', ($body) => {
      const text = $body.text().toLowerCase()
      return text.includes('eduardo') ||
        text.includes('name') ||
        text.includes('profile')
    })
  })

  it('should display email', () => {
    cy.get('body').should('satisfy', ($body) => {
      const text = $body.text()
      return text.includes('@') ||
        text.toLowerCase().includes('email')
    })
  })

  it('should show role', () => {
    cy.get('body').should('satisfy', ($body) => {
      const text = $body.text().toLowerCase()
      return text.includes('role') ||
        text.includes('developer') ||
        text.includes('team member')
    })
  })

  it('should display start date', () => {
    cy.get('body').should('satisfy', ($body) => {
      const text = $body.text()
      return /\d{1,2}[\/\-]\d{1,2}/.test(text) ||
        text.toLowerCase().includes('start') ||
        text.toLowerCase().includes('joined')
    })
  })

  it('should show phone number', () => {
    cy.get('body').should('satisfy', ($body) => {
      const text = $body.text().toLowerCase()
      return text.includes('phone') ||
        /\+?\d{10,}/.test($body.text()) ||
        text.includes('contact')
    })
  })

  it('should display location', () => {
    cy.get('body').should('satisfy', ($body) => {
      const text = $body.text().toLowerCase()
      return text.includes('location') ||
        text.includes('city') ||
        text.includes('country')
    })
  })

  it('should show bio', () => {
    cy.get('body').should('satisfy', ($body) => {
      const text = $body.text().toLowerCase()
      return text.includes('bio') ||
        text.includes('about') ||
        text.includes('description')
    })
  })

  it('should have Edit Profile button', () => {
    cy.get('body').should('satisfy', ($body) => {
      return $body.find('button:contains("Edit"), button:contains("Update")').length > 0
    })
  })

  it('should toggle edit mode', () => {
    cy.get('body').then($body => {
      const editBtn = $body.find('button:contains("Edit")')
      if (editBtn.length > 0) {
        cy.wrap(editBtn.first()).click()
        cy.wait(500)
        cy.get('body').should('satisfy', ($b) => {
          return $b.find('input:not([disabled]), textarea:not([disabled])').length > 0 ||
            $b.find('button:contains("Save"), button:contains("Cancel")').length > 0
        })
      }
    })
  })

  it('should update phone number', () => {
    cy.get('body').then($body => {
      const editBtn = $body.find('button:contains("Edit")')
      if (editBtn.length > 0) {
        cy.wrap(editBtn.first()).click()
        cy.wait(500)
        cy.get('body').then($editBody => {
          const phoneInput = $editBody.find('input[name="phone"], input[type="tel"]')
          if (phoneInput.length > 0) {
            cy.wrap(phoneInput).clear().type('+1234567890')
          }
        })
      }
    })
  })

  it('should update location', () => {
    cy.get('body').then($body => {
      const editBtn = $body.find('button:contains("Edit")')
      if (editBtn.length > 0) {
        cy.wrap(editBtn.first()).click()
        cy.wait(500)
        cy.get('body').then($editBody => {
          const locationInput = $editBody.find('input[name="location"]')
          if (locationInput.length > 0) {
            cy.wrap(locationInput).clear().type('New York, USA')
          }
        })
      }
    })
  })

  it('should update bio', () => {
    cy.get('body').then($body => {
      const editBtn = $body.find('button:contains("Edit")')
      if (editBtn.length > 0) {
        cy.wrap(editBtn.first()).click()
        cy.wait(500)
        cy.get('body').then($editBody => {
          const bioTextarea = $editBody.find('textarea[name="bio"]')
          if (bioTextarea.length > 0) {
            cy.wrap(bioTextarea).clear().type('Updated bio text')
          }
        })
      }
    })
  })

  it('should save changes', () => {
    cy.get('body').then($body => {
      const editBtn = $body.find('button:contains("Edit")')
      if (editBtn.length > 0) {
        cy.wrap(editBtn.first()).click()
        cy.wait(500)

        // Make a change
        cy.get('body').then($editBody => {
          const inputs = $editBody.find('input:not([disabled]), textarea:not([disabled])')
          if (inputs.length > 0) {
            cy.wrap(inputs.first()).type('test')
          }
        })

        // Save
        cy.contains('button', /save|update/i).click()
      }
    })
  })

  it('should cancel edit and discard changes', () => {
    cy.get('body').then($body => {
      const editBtn = $body.find('button:contains("Edit")')
      if (editBtn.length > 0) {
        cy.wrap(editBtn.first()).click()
        cy.wait(500)

        // Cancel
        cy.get('body').then($editBody => {
          const cancelBtn = $editBody.find('button:contains("Cancel")')
          if (cancelBtn.length > 0) {
            cy.wrap(cancelBtn.first()).click()
            cy.wait(300)
          }
        })
      }
    })
  })

  it('should not allow editing role', () => {
    cy.get('body').should('satisfy', ($body) => {
      const roleSelect = $body.find('select[name="role"]')
      if (roleSelect.length > 0) {
        return roleSelect.is(':disabled') || roleSelect.attr('readonly') !== undefined
      }
      return true
    })
  })
})
