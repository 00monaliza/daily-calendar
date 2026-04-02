import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'
import { format, addMonths } from 'date-fns'

test.describe('Шахматка', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto('/')
  })

  test('страница загружается и показывает дни текущего месяца', async ({ page }) => {
    const today = new Date()
    const dayNum = String(today.getDate())
    // The grid header shows day numbers — today's day number should be visible
    await expect(page.locator('thead').getByText(dayNum).first()).toBeVisible()
  })

  test('кнопка "Сегодня" присутствует', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Сегодня' })).toBeVisible()
  })

  test('инпут "Перейти к" присутствует', async ({ page }) => {
    await expect(page.getByLabel('Перейти к')).toBeVisible()
  })

  test('teleport: выбор месяца показывает дни выбранного месяца', async ({ page }) => {
    const nextMonth = addMonths(new Date(), 1)
    const yearMonth = format(nextMonth, 'yyyy-MM')
    const lastDayOfNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0)
    const lastDay = String(lastDayOfNextMonth.getDate())

    await page.getByLabel('Перейти к').fill(yearMonth)
    await page.getByLabel('Перейти к').dispatchEvent('change')

    await expect(page.locator('thead').getByText(lastDay).first()).toBeVisible()
  })

  test('кнопка "Сегодня" возвращает к текущему месяцу', async ({ page }) => {
    const today = new Date()
    const nextMonth = addMonths(today, 3)
    const yearMonth = format(nextMonth, 'yyyy-MM')

    // Teleport away
    await page.getByLabel('Перейти к').fill(yearMonth)
    await page.getByLabel('Перейти к').dispatchEvent('change')

    // Come back
    await page.getByRole('button', { name: 'Сегодня' }).click()

    const dayNum = String(today.getDate())
    await expect(page.locator('thead').getByText(dayNum).first()).toBeVisible()
  })
})
