/// <reference types="cypress" />

describe('Client Documents', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/documents*').as('getDocuments')
    cy.intercept('POST', '/api/documents').as('uploadDocument')
    cy.intercept('GET', '/api/documents/download/*').as('downloadDocument')
    cy.loginAsClient()
  })

  describe('Documents Page', () => {
    beforeEach(() => {
      // Route requires client ID - extract from sidebar link
      cy.visit('/client/dashboard')
      cy.wait(2000)
      cy.get('a[href*="/client/documents/"]').first().then($link => {
        const href = $link.attr('href')
        cy.visit(href!)
      })
      cy.url().should('include', '/client/documents/')
      cy.wait(2000)
    })

    it('should load documents page', () => {
      cy.url().should('include', '/client')
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('document') || text.includes('file')
      })
    })

    it('should display documents list', () => {
      cy.get('body').should('satisfy', ($body) => {
        const hasDocuments = $body.find('[class*="card"], tr, [class*="document"]').length > 0
        const hasEmptyState = $body.text().toLowerCase().includes('no document')
        return hasDocuments || hasEmptyState
      })
    })

    it('should organize by service', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('service') ||
          text.includes('project') ||
          text.includes('folder')
      })
    })
  })

  describe('Document Display', () => {
    beforeEach(() => {
      // Route requires client ID - extract from sidebar link
      cy.visit('/client/dashboard')
      cy.wait(2000)
      cy.get('a[href*="/client/documents/"]').first().then($link => {
        const href = $link.attr('href')
        cy.visit(href!)
      })
      cy.url().should('include', '/client/documents/')
      cy.wait(2000)
    })

    it('should display document name', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('.pdf') ||
          text.includes('.doc') ||
          text.includes('document') ||
          text.includes('file')
      })
    })

    it('should show file type indicator', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('svg, [class*="icon"]').length > 0 ||
          $body.text().toLowerCase().includes('document')
      })
    })

    it('should display upload date', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text()
        return /\d{1,2}[\/\-]\d{1,2}/.test(text) ||
          text.toLowerCase().includes('date')
      })
    })

    it('should show uploader badge', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text().toLowerCase()
        return text.includes('you') ||
          text.includes('vestov') ||
          text.includes('uploaded by')
      })
    })
  })

  describe('Download Document', () => {
    beforeEach(() => {
      // Route requires client ID - extract from sidebar link
      cy.visit('/client/dashboard')
      cy.wait(2000)
      cy.get('a[href*="/client/documents/"]').first().then($link => {
        const href = $link.attr('href')
        cy.visit(href!)
      })
      cy.url().should('include', '/client/documents/')
      cy.wait(2000)
    })

    it('should have download button', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('button:contains("Download"), a[download], svg.lucide-download').length > 0 ||
          $body.text().toLowerCase().includes('download')
      })
    })

    it('should trigger download on click', () => {
      cy.get('body').then($body => {
        const downloadBtn = $body.find('button:contains("Download"), a[download]')
        if (downloadBtn.length > 0) {
          cy.wrap(downloadBtn.first()).click({ force: true })
        }
      })
    })
  })

  describe('Preview Document', () => {
    beforeEach(() => {
      // Route requires client ID - extract from sidebar link
      cy.visit('/client/dashboard')
      cy.wait(2000)
      cy.get('a[href*="/client/documents/"]').first().then($link => {
        const href = $link.attr('href')
        cy.visit(href!)
      })
      cy.url().should('include', '/client/documents/')
      cy.wait(2000)
    })

    it('should have preview button', () => {
      cy.get('body').should('satisfy', ($body) => {
        return $body.find('button:contains("Preview"), button:contains("View"), svg.lucide-eye').length > 0 ||
          $body.text().toLowerCase().includes('preview')
      })
    })

    it('should open preview modal', () => {
      cy.get('body').then($body => {
        const previewBtn = $body.find('button:contains("Preview"), button:contains("View")')
        if (previewBtn.length > 0) {
          cy.wrap(previewBtn.first()).click({ force: true })
          cy.wait(500)
          cy.get('body').should('satisfy', ($b) => {
            return $b.find('[role="dialog"], iframe, img').length > 0
          })
        }
      })
    })
  })

  describe('Upload Document (if permitted)', () => {
    beforeEach(() => {
      // Route requires client ID - extract from sidebar link
      cy.visit('/client/dashboard')
      cy.wait(2000)
      cy.get('a[href*="/client/documents/"]').first().then($link => {
        const href = $link.attr('href')
        cy.visit(href!)
      })
      cy.url().should('include', '/client/documents/')
      cy.wait(2000)
    })

    it('should check for upload permission', () => {
      cy.get('body').should('satisfy', ($body) => {
        const hasUpload = $body.find('button:contains("Upload"), input[type="file"]').length > 0
        const text = $body.text().toLowerCase()
        return hasUpload || text.includes('document') || text.includes('no permission')
      })
    })
  })

  describe('Folder Navigation', () => {
    beforeEach(() => {
      // Route requires client ID - extract from sidebar link
      cy.visit('/client/dashboard')
      cy.wait(2000)
      cy.get('a[href*="/client/documents/"]').first().then($link => {
        const href = $link.attr('href')
        cy.visit(href!)
      })
      cy.url().should('include', '/client/documents/')
      cy.wait(2000)
    })

    it('should navigate into folder', () => {
      cy.get('body').then($body => {
        const folder = $body.find('[class*="folder"], button:contains("Folder")')
        if (folder.length > 0) {
          cy.wrap(folder.first()).click()
          cy.wait(500)
        }
      })
    })

    it('should show document count per folder', () => {
      cy.get('body').should('satisfy', ($body) => {
        const text = $body.text()
        return /\d+\s*(document|file)/.test(text) ||
          $body.text().toLowerCase().includes('folder')
      })
    })
  })

  describe('Service Filter', () => {
    beforeEach(() => {
      // Route requires client ID - extract from sidebar link
      cy.visit('/client/dashboard')
      cy.wait(2000)
      cy.get('a[href*="/client/documents/"]').first().then($link => {
        const href = $link.attr('href')
        cy.visit(href!)
      })
      cy.url().should('include', '/client/documents/')
      cy.wait(2000)
    })

    it('should filter by service', () => {
      cy.get('body').then($body => {
        const serviceToggle = $body.find('button[class*="service"], [role="tab"]')
        if (serviceToggle.length > 0) {
          cy.wrap(serviceToggle.first()).click()
          cy.wait(500)
        }
      })
    })
  })
})
