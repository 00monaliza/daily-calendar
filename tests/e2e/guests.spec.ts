import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

test.describe('Гости', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto('/guests')
  })

  test('страница загружается с заголовком "База гостей"', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'База гостей' })).toBeVisible()
  })

  test('поле поиска присутствует', async ({ page }) => {
    await expect(page.getByPlaceholder('Поиск по имени или телефону...')).toBeVisible()
  })

  test('поиск по несуществующему имени — таблица показывает "Гостей не найдено"', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Поиск по имени или телефону...')
    await searchInput.fill('xyzНесуществующийГость999')
    await expect(page.getByText('Гостей не найдено')).toBeVisible()
  })

  test('очистка поиска убирает сообщение "Гостей не найдено"', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Поиск по имени или телефону...')
    await searchInput.fill('xyzНесуществующийГость999')
    await expect(page.getByText('Гостей не найдено')).toBeVisible()

    await searchInput.clear()
    // Таблица снова рендерится (пустая или с данными, но без сообщения об ошибке)
    await expect(page.getByText('Гостей не найдено')).not.toBeVisible()
  })

  test('заголовки таблицы присутствуют', async ({ page }) => {
    await expect(page.getByText('Гость')).toBeVisible()
    await expect(page.getByText('Броней')).toBeVisible()
    await expect(page.getByText('Последний заезд')).toBeVisible()
  })
})
