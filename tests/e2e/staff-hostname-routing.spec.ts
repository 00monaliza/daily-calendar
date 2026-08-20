import { expect, test } from '@playwright/test'

test('employee portal surface never exposes owner-only navigation', async ({ page }) => {
  await page.goto('/login?staff=1')

  await expect(page.getByRole('heading', { name: 'Pogostim Staff' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Квартиры' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Финансы' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Гости' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Персонал' })).toHaveCount(0)
})
