import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
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
})

test('manager can create an employee, build a shift, and see correct worked-days total', async ({ page }) => {
  const employeeName = `E2E Test ${Date.now()}`

  await page.goto('/staff')
  await expect(page.getByRole('heading', { name: 'График сотрудников' })).toBeVisible()

  // Add an employee
  await page.getByRole('button', { name: '+ Добавить' }).click()
  await page.getByLabel('Имя', { exact: true }).fill(employeeName)
  await page.getByLabel('Должность').fill('E2E Server')
  await page.getByLabel('Логин (телефон или имя пользователя)').fill(`e2e${Date.now()}`)
  await page.getByRole('button', { name: 'Добавить', exact: true }).click()

  // Open the first day cell for this employee and set a work shift
  const row = page.getByRole('row', { name: employeeName })
  await expect(row).toBeVisible()
  await row.locator('td').nth(1).locator('button').click()

  await expect(page.getByRole('heading', { name: 'Смена' })).toBeVisible()
  await page.getByLabel('Начало').fill('08:00')
  await page.getByLabel('Конец').fill('17:00')
  await page.getByRole('button', { name: 'Сохранить' }).click()

  // Confirm the cell now shows the time range and the row shows 1 worked day
  await expect(row.getByText('08:00–17:00')).toBeVisible()
  await expect(row.locator('td').last()).toHaveText('1')
})
