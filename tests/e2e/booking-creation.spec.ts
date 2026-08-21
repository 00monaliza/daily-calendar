import { expect, test, type Page } from '@playwright/test'

/**
 * Regression coverage for the "book a slot" flow: clicking an empty cell in
 * the chess grid to create a new booking via BookingModal.
 *
 * Both bugs below were originally found via adversarial testing of the real
 * app (not by reading code in isolation) and have since been fixed:
 *   1. useUser() now reads a single shared session from <AuthProvider>
 *      instead of every call site firing its own independent
 *      supabase.auth.getUser() request.
 *   2. BookingModal now parses date-only strings with date-fns' parseISO
 *      (local-time semantics) instead of `new Date(str)` (UTC semantics).
 * These tests now assert the CORRECT behavior and pass; keep them as
 * regression coverage against both bugs reappearing.
 */

async function login(page: Page) {
  const email = process.env.TEST_EMAIL
  const password = process.env.TEST_PASSWORD
  if (!email || !password) {
    throw new Error('TEST_EMAIL and TEST_PASSWORD must be set in .env.local')
  }

  await page.goto('/auth')
  await page.locator('#auth-email').fill(email)
  await page.locator('#auth-password').fill(password)
  await page.getByRole('button', { name: 'Войти' }).click()
  await page.waitForURL('/')
  await page.waitForSelector('table', { timeout: 15000 })
  await page.waitForTimeout(1500)
}

// Empty (unbooked) cells in the desktop ChessGrid carry this specific hover
// class that booked cells do not, so this reliably targets an empty cell
// without accidentally opening the "edit booking" modal instead.
function emptyCell(page: Page) {
  return page.locator('td.hover\\:bg-\\[\\#376E6F\\]\\/10').last()
}

test.describe('booking creation via empty-cell click', () => {
  test('Save still works even if a stray /auth/v1/user request fails after the grid has loaded', async ({ page }) => {
    // Regression test for the useUser() thundering-herd bug (see file header).
    // Even with an /auth/v1/user request failing, AuthProvider's single
    // shared session (fetched once, before this route is installed) means
    // BookingModal's `user` is already populated and Save works normally.
    await login(page)

    await page.route('**/auth/v1/user*', route => route.abort('failed'))

    await emptyCell(page).click()
    await page.waitForSelector('text=Новая бронь', { timeout: 15000 })

    const uniqueGuestName = `E2E Race Guest ${Date.now()}`
    await page.getByPlaceholder('Иванов Иван').fill(uniqueGuestName)

    const createRequest = page
      .waitForRequest(
        req => req.url().includes('/rest/v1/bookings') && req.method() === 'POST',
        { timeout: 5000 },
      )
      .catch(() => null)

    await page.getByRole('button', { name: 'Сохранить' }).click()

    const request = await createRequest
    expect(request, 'Save should have attempted to create the booking').not.toBeNull()
    await expect(page.getByText('Новая бронь')).not.toBeVisible({ timeout: 5000 })
  })

  test.describe('checkout date defaults across timezones', () => {
    test.use({ timezoneId: 'America/Los_Angeles' })

    test('for a user west of UTC, the new-booking modal defaults checkout to the day after check-in', async ({ page }) => {
      // Regression test for the parseISO/UTC date-parsing bug (see file
      // header). BookingModal now uses parseISO (local-time semantics)
      // instead of `new Date(str)` (UTC semantics) to derive the default
      // checkout date, so it correctly lands one day after check-in
      // regardless of the browser's timezone.
      await login(page)

      await emptyCell(page).click()
      await page.waitForSelector('text=Новая бронь', { timeout: 15000 })

      const checkInInput = page.locator('input[type="date"]').first()
      const checkOutInput = page.locator('input[type="date"]').nth(1)
      const checkIn = await checkInInput.inputValue()
      const checkOut = await checkOutInput.inputValue()

      // Expected: checkout defaults to the day *after* check-in.
      const expectedCheckOut = new Date(checkIn + 'T00:00:00Z')
      expectedCheckOut.setUTCDate(expectedCheckOut.getUTCDate() + 1)
      const expectedCheckOutStr = expectedCheckOut.toISOString().slice(0, 10)

      expect(checkOut, 'checkout should default to one day after check-in').toBe(expectedCheckOutStr)

      await page.getByPlaceholder('Иванов Иван').fill(`E2E TZ Guest ${Date.now()}`)
      await expect(page.getByRole('button', { name: 'Сохранить' })).toBeEnabled()
    })
  })
})
