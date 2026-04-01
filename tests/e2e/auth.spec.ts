import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

test.describe('Авторизация', () => {
  test('неавторизованный пользователь перенаправляется на /auth', async ({ page }) => {
    await page.goto('/')
    await page.waitForURL('**/auth')
    expect(page.url()).toContain('/auth')
  })

  test('неавторизованный пользователь при прямом переходе на /properties видит /auth', async ({ page }) => {
    await page.goto('/properties')
    await page.waitForURL('**/auth')
    expect(page.url()).toContain('/auth')
  })

  test('страница /auth содержит форму входа', async ({ page }) => {
    await page.goto('/auth')
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Пароль')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Войти' })).toBeVisible()
  })

  test('вход с верными данными — редирект на главную', async ({ page }) => {
    await login(page)
    await expect(page).toHaveURL('/')
    // После входа заголовок страницы (Шахматка) или навигация видна
    await expect(page.getByText('Сегодня')).toBeVisible()
  })

  test('вход с неверным паролем — показывается ошибка, редиректа нет', async ({ page }) => {
    await page.goto('/auth')
    await page.getByLabel('Email').fill(process.env.TEST_EMAIL ?? '')
    await page.getByLabel('Пароль').fill('wrong_password_xyz')
    await page.getByRole('button', { name: 'Войти' }).click()
    // Должна появиться ошибка
    await expect(page.locator('.bg-red-50')).toBeVisible()
    // Остаёмся на /auth
    expect(page.url()).toContain('/auth')
  })
})
