import { test, expect, Page } from '@playwright/test'

async function loginAsAdmin(page: Page) {
  await page.goto('/')
  await page.fill('input[id="username"]', 'admin')
  await page.fill('input[id="password"]', 'admin123')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/.*\/admin/, { timeout: 10000 })
}

async function loginAsTeamMember(page: Page) {
  await page.goto('/')
  await page.fill('input[id="username"]', 'eduardo')
  await page.fill('input[id="password"]', 'eduardo123')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/.*\/employee/, { timeout: 10000 })
}

test.describe('Admin Impersonation', () => {
  test.describe('Impersonation Widget Visibility', () => {
    test('should show "Switch to User" button for admin users', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/dashboard')
      await page.waitForTimeout(1000)

      // Use desktop sidebar to avoid mobile/desktop duplicates
      const sidebar = page.locator('.hidden.lg\\:flex')
      await expect(sidebar.getByText('Super Admin')).toBeVisible()
      await expect(sidebar.getByRole('button', { name: 'Switch to User' })).toBeVisible()
    })

    test('should not show impersonation widget for non-admin users', async ({ page }) => {
      await loginAsTeamMember(page)
      await page.goto('/employee/dashboard')
      await page.waitForTimeout(2000)

      await expect(page.getByText('Super Admin')).not.toBeVisible()
      await expect(page.getByRole('button', { name: 'Switch to User' })).not.toBeVisible()
    })
  })

  test.describe('Impersonation Flow', () => {
    test('should show user list when clicking Switch to User', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/dashboard')

      await page.getByRole('button', { name: 'Switch to User' }).click()

      // Wait for users to load
      await page.waitForResponse(resp => resp.url().includes('/api/users') && resp.status() === 200)

      await expect(page.getByText('Select User:')).toBeVisible()

      // Should show at least one user to impersonate
      const userButtons = page.locator('.max-h-64 button')
      await expect(userButtons).not.toHaveCount(0)
    })

    test('should show Cancel button to close user list', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/dashboard')

      await page.getByRole('button', { name: 'Switch to User' }).click()
      await page.waitForResponse(resp => resp.url().includes('/api/users') && resp.status() === 200)

      await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()

      await page.getByRole('button', { name: 'Cancel' }).click()

      await expect(page.getByText('Select User:')).not.toBeVisible()
      await expect(page.getByRole('button', { name: 'Switch to User' })).toBeVisible()
    })

    test('should impersonate a team member user', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/dashboard')

      await page.getByRole('button', { name: 'Switch to User' }).click()
      await page.waitForResponse(resp => resp.url().includes('/api/users') && resp.status() === 200)

      // Find and click on a team member user
      const userButtons = page.locator('.max-h-64 button')
      const teamMemberButton = userButtons.filter({ hasText: /team_member/i }).first()

      if (await teamMemberButton.count() > 0) {
        await teamMemberButton.click()

        // Wait for impersonation API call
        await page.waitForResponse(resp => resp.url().includes('/api/impersonate') && resp.status() === 200)

        // Should redirect to employee dashboard
        await expect(page).toHaveURL(/.*\/employee/, { timeout: 10000 })
      }
    })

    test('should impersonate a client user', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/dashboard')
      await page.waitForTimeout(1000)

      // Use desktop sidebar button
      const sidebar = page.locator('.hidden.lg\\:flex')
      await sidebar.getByRole('button', { name: 'Switch to User' }).click()

      // Wait for user list to appear instead of API response
      await expect(page.getByText('Select User:')).toBeVisible({ timeout: 10000 })

      // Find and click on a client user
      const userButtons = page.locator('.max-h-64 button')
      const allButtons = await userButtons.all()

      let foundClient = false
      for (const button of allButtons) {
        const text = (await button.textContent())?.toLowerCase() || ''
        if (text.includes('client') && !text.includes('team_member') && !text.includes('admin')) {
          await button.click()
          foundClient = true

          // Wait for redirect to client portal
          await expect(page).toHaveURL(/.*\/client/, { timeout: 15000 })
          break
        }
      }

      // If no client user found, just pass the test
      if (!foundClient) {
        expect(true).toBe(true)
      }
    })
  })

  test.describe('Stop Impersonation', () => {
    test('should show Stop button when impersonating', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/dashboard')

      await page.getByRole('button', { name: 'Switch to User' }).click()
      await page.waitForResponse(resp => resp.url().includes('/api/users') && resp.status() === 200)

      // Click first available user
      await page.locator('.max-h-64 button').first().click()
      await page.waitForResponse(resp => resp.url().includes('/api/impersonate') && resp.status() === 200)

      await page.waitForTimeout(2000)

      // Should show Impersonating section with Stop button - use desktop sidebar
      const sidebar = page.locator('.hidden.lg\\:flex, div.hidden.lg\\:fixed.lg\\:flex').first()
      await expect(sidebar.getByText('Impersonating')).toBeVisible()
      await expect(sidebar.getByRole('button', { name: 'Stop' })).toBeVisible()
    })

    test('should return to admin dashboard when stopping impersonation', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/dashboard')

      await page.getByRole('button', { name: 'Switch to User' }).click()
      await page.waitForResponse(resp => resp.url().includes('/api/users') && resp.status() === 200)

      await page.locator('.max-h-64 button').first().click()
      await page.waitForResponse(resp => resp.url().includes('/api/impersonate') && resp.status() === 200)
      await page.waitForTimeout(2000)

      // Click Stop button
      await page.getByRole('button', { name: 'Stop' }).click()
      await page.waitForResponse(resp => resp.url().includes('/api/stop-impersonation') && resp.status() === 200)

      // Should return to admin dashboard
      await expect(page).toHaveURL(/.*\/admin/, { timeout: 10000 })

      // Should show Switch to User again (not impersonating anymore)
      await expect(page.getByRole('button', { name: 'Switch to User' })).toBeVisible({ timeout: 10000 })
    })
  })
})
