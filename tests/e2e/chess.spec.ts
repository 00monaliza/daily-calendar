import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'
import { format, addMonths, subMonths } from 'date-fns'
import { ru } from 'date-fns/locale'

test.describe('Шахматка', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto('/')
  })

  test('страница загружается и показывает текущий месяц', async ({ page }) => {
    const now = new Date()
    const monthLabel = format(now, 'LLLL yyyy', { locale: ru })
    await expect(page.getByText(monthLabel)).toBeVisible()
  })

  test('кнопка "Сегодня" присутствует', async ({ page }) => {
    await expect(page.getByText('Сегодня')).toBeVisible()
  })

  test('навигация назад — показывает предыдущий месяц', async ({ page }) => {
    const prevMonth = subMonths(new Date(), 1)
    const prevLabel = format(prevMonth, 'LLLL yyyy', { locale: ru })

    await page.getByRole('button', { name: '‹' }).click()
    await expect(page.getByText(prevLabel)).toBeVisible()
  })

  test('навигация вперёд — показывает следующий месяц', async ({ page }) => {
    const nextMonth = addMonths(new Date(), 1)
    const nextLabel = format(nextMonth, 'LLLL yyyy', { locale: ru })

    await page.getByRole('button', { name: '›' }).click()
    await expect(page.getByText(nextLabel)).toBeVisible()
  })

  test('кнопка "Сегодня" возвращает к текущему месяцу', async ({ page }) => {
    const now = new Date()
    const currentLabel = format(now, 'LLLL yyyy', { locale: ru })

    // Уходим на следующий месяц
    await page.getByRole('button', { name: '›' }).click()
    // Возвращаемся кнопкой "Сегодня"
    await page.getByText('Сегодня').click()
    await expect(page.getByText(currentLabel)).toBeVisible()
  })
})
