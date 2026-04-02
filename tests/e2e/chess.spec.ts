import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'
import { format, addMonths } from 'date-fns'

test.describe('Шахматка', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto('/')
  })

  test('страница загружается и показывает сегодняшний день', async ({ page }) => {
    const today = new Date()
    const dayNum = String(today.getDate())
    // Find the th that contains today's day number AND has the today-highlight class
    const todayTh = page.locator('thead th').filter({
      has: page.locator(`div.font-bold:text("${dayNum}")`)
    })
    await expect(todayTh.first()).toHaveAttribute('class', /376E6F/)
  })

  test('кнопка "Сегодня" присутствует', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Сегодня' })).toBeVisible()
  })

  test('инпут "Перейти к" присутствует', async ({ page }) => {
    await expect(page.getByLabel('Перейти к')).toBeVisible()
  })

  test('teleport: выбор месяца показывает дни выбранного месяца', async ({ page }) => {
    const targetMonth = addMonths(new Date(), 6)
    const yearMonth = format(targetMonth, 'yyyy-MM')
    const lastDayOfTargetMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0)
    const lastDay = String(lastDayOfTargetMonth.getDate())

    await page.getByLabel('Перейти к').fill(yearMonth)
    await page.getByLabel('Перейти к').dispatchEvent('change')

    await expect(page.locator('thead').getByText(lastDay).first()).toBeVisible()
  })

  test('кнопка "Сегодня" возвращает к текущему месяцу', async ({ page }) => {
    const today = new Date()
    // Teleport 6 months ahead (outside the initial ±2 month window)
    const farMonth = addMonths(today, 6)
    const yearMonth = format(farMonth, 'yyyy-MM')

    await page.getByLabel('Перейти к').fill(yearMonth)
    await page.getByLabel('Перейти к').dispatchEvent('change')

    // Come back to today
    await page.getByRole('button', { name: 'Сегодня' }).click()

    // Verify today's highlighted column is visible (the teal-colored cell for today)
    const dayNum = String(today.getDate())
    const todayTh = page.locator('thead th').filter({
      has: page.locator(`div.font-bold:text("${dayNum}")`)
    })
    await expect(todayTh.first()).toHaveAttribute('class', /376E6F/)
  })
})
