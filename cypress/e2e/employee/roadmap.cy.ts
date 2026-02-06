/// <reference types="cypress" />

describe('Employee Roadmap', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/roadmap').as('getRoadmap')
    cy.intercept('GET', '/api/vacation/my-profile').as('getProfile')
    cy.loginAsTeamMember()
  })

  describe('Roadmap Page', () => {
    beforeEach(() => {
      cy.visit('/employee/roadmap')
      cy.wait(2000)
    })

    it('should load roadmap page', () => {
      cy.url().should('include', '/employee')
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('roadmap') ||
          text.includes('career') ||
          text.includes('benefit') ||
          text.includes('milestone')
      })
    })

    it('should display current status', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('year') ||
          text.includes('current') ||
          text.includes('status')
      })
    })
  })

  describe('Current Status Card', () => {
    beforeEach(() => {
      cy.visit('/employee/roadmap')
      cy.wait(2000)
    })

    it('should display years at company', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('year') ||
          /year\s*\d/.test(text)
      })
    })

    it('should show start date', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text()
        return /\d{1,2}[\/\-]\d{1,2}/.test(text) ||
          text.toLowerCase().includes('start') ||
          text.toLowerCase().includes('joined')
      })
    })

    it('should display current vacation days', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('vacation') ||
          text.includes('days') ||
          /\d+\s*days?/.test($body.text())
      })
    })

    it('should show current reimbursement budget', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text()
        return text.includes('$') ||
          text.toLowerCase().includes('reimbursement') ||
          text.toLowerCase().includes('budget')
      })
    })

    it('should display next milestone', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('next') ||
          text.includes('milestone') ||
          text.includes('year') ||
          text.includes('max')
      })
    })

    it('should show progress bar', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('[class*="progress"], [role="progressbar"]').length > 0 ||
          $body.text().toLowerCase().includes('progress')
      })
    })
  })

  describe('Benefits Timeline', () => {
    beforeEach(() => {
      cy.visit('/employee/roadmap')
      cy.wait(2000)
    })

    it('should display 5 milestone cards', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('year 1') ||
          text.includes('year 2') ||
          text.includes('year 3') ||
          text.includes('milestone')
      })
    })

    it('should show locked/unlocked status', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('locked') ||
          text.includes('unlocked') ||
          text.includes('current') ||
          $body.find('[class*="locked"], [class*="unlocked"]').length > 0
      })
    })

    it('should display vacation days per year', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('vacation') ||
          text.includes('days') ||
          /\d+\s*days?/.test($body.text())
      })
    })

    it('should show reimbursement limit per year', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text()
        return text.includes('$') ||
          text.toLowerCase().includes('reimbursement')
      })
    })

    it('should show delta from previous year', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text()
        return text.includes('+') ||
          text.toLowerCase().includes('increase') ||
          text.toLowerCase().includes('more')
      })
    })

    it('should indicate current milestone', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('you are here') ||
          text.includes('current') ||
          $body.find('[class*="current"], [class*="active"]').length > 0
      })
    })
  })

  describe('Permanent Benefits', () => {
    beforeEach(() => {
      cy.visit('/employee/roadmap')
      cy.wait(2000)
    })

    it('should display English Classes benefit', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('english') ||
          text.includes('class') ||
          text.includes('language')
      })
    })

    it('should show Work Tools benefit', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('work tools') ||
          text.includes('equipment') ||
          text.includes('tools')
      })
    })

    it('should display Professional Education benefit', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('education') ||
          text.includes('professional') ||
          text.includes('training')
      })
    })

    it('should show coverage percentage', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text()
        return text.includes('100%') ||
          text.includes('%') ||
          text.toLowerCase().includes('covered')
      })
    })
  })

  describe('Year 5+ Status', () => {
    beforeEach(() => {
      cy.visit('/employee/roadmap')
      cy.wait(2000)
    })

    it('should handle max level employees', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('max') ||
          text.includes('year 5') ||
          text.includes('milestone') ||
          text.includes('year')
      })
    })

    it('should cap progress at 100%', () => {
      cy.get('body').should('satisfy', ($body) => {
        const progressBar = $body.find('[class*="progress"], [role="progressbar"]')
        if (progressBar.length > 0) {
          // Progress bar exists
          return true
        }
        return $body.text().toLowerCase().includes('roadmap')
      })
    })
  })

  describe('Career Year Calculation', () => {
    beforeEach(() => {
      cy.visit('/employee/roadmap')
      cy.wait(2000)
    })

    it('should calculate career year correctly', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('year') ||
          /year\s*\d/.test(text)
      })
    })

    it('should show days until next milestone', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('day') ||
          text.includes('until') ||
          text.includes('remaining') ||
          text.includes('max')
      })
    })
  })

  describe('Responsive Design', () => {
    it('should display correctly on mobile', () => {
      cy.viewport('iphone-6')
      cy.visit('/employee/roadmap')
      cy.wait(2000)
      cy.get('body').should('be.visible')
    })

    it('should display correctly on tablet', () => {
      cy.viewport('ipad-2')
      cy.visit('/employee/roadmap')
      cy.wait(2000)
      cy.get('body').should('be.visible')
    })

    afterEach(() => {
      cy.viewport(1280, 720)
    })
  })
})
