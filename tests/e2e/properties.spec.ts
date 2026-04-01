import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

test.describe('Квартиры', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto('/properties')
  })

  test('страница загружается с заголовком "Квартиры"', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Квартиры' })).toBeVisible()
  })

  test('кнопка "+ Добавить квартиру" присутствует', async ({ page }) => {
    await expect(page.getByRole('button', { name: '+ Добавить квартиру' })).toBeVisible()
  })

  test('клик на "+ Добавить квартиру" открывает модальное окно', async ({ page }) => {
    await page.getByRole('button', { name: '+ Добавить квартиру' }).click()
    await expect(page.getByRole('heading', { name: 'Добавить квартиру' })).toBeVisible()
    await expect(page.getByLabel('Название *')).toBeVisible()
    await expect(page.getByLabel('Адрес')).toBeVisible()
  })

  test('модальное окно закрывается по кнопке ✕', async ({ page }) => {
    await page.getByRole('button', { name: '+ Добавить квартиру' }).click()
    await expect(page.getByRole('heading', { name: 'Добавить квартиру' })).toBeVisible()

    await page.getByRole('button', { name: '✕' }).click()
    await expect(page.getByRole('heading', { name: 'Добавить квартиру' })).not.toBeVisible()
  })

  test('модальное окно закрывается по клику на фон', async ({ page }) => {
    await page.getByRole('button', { name: '+ Добавить квартиру' }).click()
    await expect(page.getByRole('heading', { name: 'Добавить квартиру' })).toBeVisible()

    // Клик на полупрозрачный оверлей (координаты за пределами карточки)
    await page.mouse.click(10, 10)
    await expect(page.getByRole('heading', { name: 'Добавить квартиру' })).not.toBeVisible()
  })

  test('палитра цветов содержит цветные кнопки', async ({ page }) => {
    await page.getByRole('button', { name: '+ Добавить квартиру' }).click()
    // 8 цветовых кнопок внутри раздела "Цвет"
    const colorButtons = page.locator('form button[type="button"]')
    await expect(colorButtons).toHaveCount(8)
  })

  // ─────────────────────────────────────────────────────────────
  // КРИТИЧЕСКИЙ БАГ: при ошибке сервера модалка должна показывать
  // сообщение об ошибке, а НЕ закрываться молча.
  // До фикса тест падал — теперь баг исправлен в PropertiesPage.tsx.
  // ─────────────────────────────────────────────────────────────
  test('при ошибке сохранения модалка остаётся открытой и показывает ошибку', async ({ page }) => {
    // Перехватываем запрос к Supabase и возвращаем 403
    await page.route('**/rest/v1/properties**', route =>
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'new row violates row-level security policy' }),
      })
    )

    await page.getByRole('button', { name: '+ Добавить квартиру' }).click()
    await page.getByLabel('Название *').fill('Тестовая квартира')
    await page.getByRole('button', { name: 'Сохранить' }).click()

    // Модалка должна оставаться открытой
    await expect(page.getByRole('heading', { name: 'Добавить квартиру' })).toBeVisible()

    // Сообщение об ошибке должно появиться внутри модалки
    await expect(page.locator('.bg-red-50')).toBeVisible()
  })

  test('форма не отправляется без обязательного поля "Название"', async ({ page }) => {
    await page.getByRole('button', { name: '+ Добавить квартиру' }).click()
    // Не заполняем название — кликаем "Сохранить"
    await page.getByRole('button', { name: 'Сохранить' }).click()
    // Модалка остаётся: браузер блокирует отправку через HTML5 required
    await expect(page.getByRole('heading', { name: 'Добавить квартиру' })).toBeVisible()
  })
})
