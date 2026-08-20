import { expect, test } from '@playwright/test'

test('employee can log in after manager grants access and sees their schedule', async ({ page }) => {
  const email = process.env.TEST_EMAIL
  const password = process.env.TEST_PASSWORD
  if (!email || !password) {
    throw new Error('TEST_EMAIL and TEST_PASSWORD must be set in .env.local')
  }

  const employeeName = `Portal E2E ${Date.now()}`
  const login = `portale2e${Date.now()}`
  const pin = '135790'

  // Manager: sign in, create the employee, grant access, set today's shift
  await page.goto('/auth')
  await page.locator('#auth-email').fill(email)
  await page.locator('#auth-password').fill(password)
  await page.getByRole('button', { name: 'Войти' }).click()
  await page.waitForURL('/')

  await page.goto('/staff')
  await page.getByRole('button', { name: '+ Добавить' }).click()
  await page.getByLabel('Имя', { exact: true }).fill(employeeName)
  await page.getByLabel('Должность').fill('Portal Server')
  await page.getByLabel('Логин (телефон или имя пользователя)').fill(login)
  await page.getByRole('button', { name: 'Добавить', exact: true }).click()

  await page.getByRole('button', { name: 'Доступ' }).click()
  await page.getByPlaceholder('••••••').fill(pin)
  await page.getByRole('button', { name: 'Выдать доступ' }).click()

  const row = page.getByRole('row', { name: employeeName })
  await expect(row).toBeVisible()
  await row.locator('td').nth(1).locator('button').click()
  await page.getByLabel('Начало').fill('09:00')
  await page.getByLabel('Конец').fill('18:00')
  await page.getByRole('button', { name: 'Сохранить' }).click()
  await expect(row.getByText('09:00–18:00')).toBeVisible()

  // Employee: sign out of the owner session, then log into the staff portal.
  // A short pause after sign-out avoids a Supabase Auth client-side lock
  // race (navigator.locks) between the outgoing session's cleanup and the
  // next sign-in — harmless in real usage at human typing speed, but
  // Playwright's actions are fast enough to hit it back-to-back.
  await page.getByRole('button', { name: 'Личный кабинет' }).click()
  await page.getByRole('button', { name: 'Выйти' }).click()
  await page.waitForURL('/auth')
  await page.waitForTimeout(500)

  await page.goto('/login?staff=1')
  await page.getByPlaceholder('Телефон или имя пользователя').fill(login)
  await page.getByPlaceholder('••••••').fill(pin)
  await page.getByRole('button', { name: 'Войти' }).click()

  await expect(page.getByText(employeeName)).toBeVisible()
  await expect(page.getByText('09:00–18:00')).toBeVisible()
})
