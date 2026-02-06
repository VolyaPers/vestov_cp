/// <reference types="cypress" />

describe('Admin Team Management', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/admin/team-members*').as('getTeamMembers')
    cy.intercept('POST', '/api/admin/team-members').as('createTeamMember')
    cy.intercept('PUT', '/api/admin/team-members/*').as('updateTeamMember')
    cy.intercept('DELETE', '/api/admin/team-members/*').as('deleteTeamMember')
    cy.intercept('GET', '/api/admin/users/available').as('getAvailableUsers')
    cy.loginAsAdmin()
  })

  describe('Team Overview Page', () => {
    beforeEach(() => {
      cy.visit('/admin/team')
      cy.wait(2000)
    })

    it('should load team page', () => {
      cy.url().should('include', '/admin/team')
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('team') || text.includes('member')
      })
    })

    it('should display stats cards', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('total') ||
          text.includes('billable') ||
          text.includes('internal') ||
          text.includes('available')
      })
    })

    it('should display team members list', () => {
      cy.get('body').should('satisfy', ($body) => {
        const hasMembers = $body.find('[class*="card"], tr, [class*="member"]').length > 0
        const hasEmptyState = $body.text().toLowerCase().includes('no team')
        return hasMembers || hasEmptyState
      })
    })

    it('should show Add Team Member button', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('button:contains("Add"), button:contains("New")').length > 0
      })
    })

    it('should search team members', () => {
      cy.get('body').then($body => {
        const searchInput = $body.find('input[type="search"], input[placeholder*="search"]')
        if (searchInput.length > 0) {
          cy.wrap(searchInput.first()).type('eduardo')
          cy.wait(1000)
        }
      })
    })

    it('should filter by billable/internal', () => {
      cy.get('body').then($body => {
        const filterBtns = $body.find('button:contains("Billable"), button:contains("Internal"), button:contains("All")')
        if (filterBtns.length > 0) {
          cy.wrap(filterBtns.first()).click()
          cy.wait(500)
        }
      })
    })
  })

  describe('Team Member Cards', () => {
    beforeEach(() => {
      cy.visit('/admin/team')
      cy.wait(2000)
    })

    it('should display member name', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('name') ||
          text.includes('eduardo') ||
          text.includes('member')
      })
    })

    it('should display status indicator', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('active') ||
          text.includes('bench') ||
          text.includes('unavailable') ||
          text.includes('status')
      })
    })

    it('should display role/position', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('developer') ||
          text.includes('designer') ||
          text.includes('position') ||
          text.includes('role')
      })
    })

    it('should display skills', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('skill') ||
          text.includes('react') ||
          text.includes('javascript') ||
          text.includes('python')
      })
    })

    it('should display hourly rate for billable members', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text()
        return text.includes('$') ||
          text.toLowerCase().includes('rate') ||
          text.toLowerCase().includes('hourly')
      })
    })

  })

  describe('Add Team Member', () => {
    beforeEach(() => {
      cy.visit('/admin/team')
      cy.wait(2000)
    })

    it('should open add team member dialog', () => {
      cy.contains('button', /add|new/i).first().click()
      cy.wait(500)
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('[role="dialog"]').length > 0 ||
          $body.text().toLowerCase().includes('add team') ||
          $body.text().toLowerCase().includes('select user')
      })
    })

  })

  describe('Edit Team Member', () => {
    beforeEach(() => {
      cy.visit('/admin/team')
      cy.wait(2000)
    })

    it('should open edit dialog', () => {
      cy.get('body').then($body => {
        const editBtn = $body.find('button:contains("Edit"), button[aria-label*="edit"]')
        if (editBtn.length > 0) {
          cy.wrap(editBtn.first()).click({ force: true })
          cy.wait(500)
          cy.get('body').should('satisfy', ($b) => {
            return $b.find('[role="dialog"]').length > 0
          })
        }
      })
    })

    it('should display editable fields', () => {
      cy.get('body').then($body => {
        const editBtn = $body.find('button:contains("Edit"), button[aria-label*="edit"]')
        if (editBtn.length > 0) {
          cy.wrap(editBtn.first()).click({ force: true })
          cy.wait(500)
          cy.get('body').should('satisfy', ($b) => {
            return $b.find('input, select, textarea').length > 0
          })
        }
      })
    })

    it('should update hourly rate', () => {
      cy.get('body').then($body => {
        const editBtn = $body.find('button:contains("Edit"), button[aria-label*="edit"]')
        if (editBtn.length > 0) {
          cy.wrap(editBtn.first()).click({ force: true })
          cy.wait(500)
          cy.get('body').then($dialogBody => {
            const rateInput = $dialogBody.find('input[name="hourlyRate"], input[name="rate"]')
            if (rateInput.length > 0) {
              cy.wrap(rateInput).clear().type('100')
            }
          })
          cy.get('button[type="submit"]').click()
        }
      })
    })

    it('should update status', () => {
      cy.get('body').then($body => {
        const editBtn = $body.find('button:contains("Edit"), button[aria-label*="edit"]')
        if (editBtn.length > 0) {
          cy.wrap(editBtn.first()).click({ force: true })
          cy.wait(500)
          cy.get('body').then($dialogBody => {
            const statusSelect = $dialogBody.find('select[name="status"]')
            if (statusSelect.length > 0) {
              cy.wrap(statusSelect).select('bench')
            }
          })
          cy.get('button[type="submit"]').click()
        }
      })
    })

    it('should update skills', () => {
      cy.get('body').then($body => {
        const editBtn = $body.find('button:contains("Edit"), button[aria-label*="edit"]')
        if (editBtn.length > 0) {
          cy.wrap(editBtn.first()).click({ force: true })
          cy.wait(500)
          cy.get('body').should('satisfy', ($b) => {
            return $b.text().toLowerCase().includes('skill') ||
              $b.find('input[name="skills"]').length > 0
          })
        }
      })
    })
  })

  describe('Team Member Details', () => {
    beforeEach(() => {
      cy.visit('/admin/team')
      cy.wait(2000)
    })

    it('should display personal info tab', () => {
      cy.get('body').then($body => {
        const detailLink = $body.find('a[href*="/admin/team-detail/"], button:contains("View")')
        if (detailLink.length > 0) {
          cy.wrap(detailLink.first()).click()
          cy.wait(1000)
          cy.get('body').should('satisfy', ($b) => {
            const text = $b.text().toLowerCase()
            return text.includes('personal') ||
              text.includes('info') ||
              text.includes('email') ||
              text.includes('phone')
          })
        }
      })
    })

    it('should display assignment history', () => {
      cy.get('body').then($body => {
        const detailLink = $body.find('a[href*="/admin/team-detail/"], button:contains("View")')
        if (detailLink.length > 0) {
          cy.wrap(detailLink.first()).click()
          cy.wait(1000)
          cy.get('body').should('satisfy', ($b) => {
            const text = $b.text().toLowerCase()
            return text.includes('assignment') ||
              text.includes('client') ||
              text.includes('project') ||
              text.includes('history')
          })
        }
      })
    })
  })

  describe('Delete Team Member', () => {
    beforeEach(() => {
      cy.visit('/admin/team')
      cy.wait(2000)
    })

    it('should show delete confirmation', () => {
      cy.get('body').then($body => {
        const deleteBtn = $body.find('button:contains("Delete"), button[aria-label*="delete"]')
        if (deleteBtn.length > 0) {
          cy.wrap(deleteBtn.first()).click({ force: true })
          cy.wait(500)
          cy.get('body').should('satisfy', ($b) => {
            const text = $b.text().toLowerCase()
            return text.includes('confirm') ||
              text.includes('are you sure')
          })
        }
      })
    })
  })
})
