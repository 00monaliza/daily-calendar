import type { Page } from '@playwright/test'

const EMAIL = process.env.TEST_EMAIL ?? ''
const PASSWORD = process.env.TEST_PASSWORD ?? ''

/**
 * Выполняет вход через форму /auth и ждёт редиректа на главную.
 */
export async function login(page: Page) {
  await page.goto('/auth')
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Пароль').fill(PASSWORD)
  await page.getByRole('button', { name: 'Войти' }).click()
  // После успешного входа происходит редирект на / (Supabase может добавить хэш/параметры)
  await page.waitForURL(/^http:\/\/localhost:5173\/?$/, { timeout: 30_000 })
}
