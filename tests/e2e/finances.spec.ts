import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'
import { format, addMonths, subMonths } from 'date-fns'
import { ru } from 'date-fns/locale'

test.describe('Финансы', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto('/finances')
  })

  test('страница загружается и показывает текущий месяц', async ({ page }) => {
    const now = new Date()
    const monthLabel = format(now, 'LLLL yyyy', { locale: ru })
    await expect(page.getByText(monthLabel)).toBeVisible()
  })

  test('карточки "Доход", "Расходы", "Прибыль" присутствуют', async ({ page }) => {
    await expect(page.getByText('Доход')).toBeVisible()
    await expect(page.getByText('Расходы')).toBeVisible()
    await expect(page.getByText('Прибыль')).toBeVisible()
  })

  test('блок "Динамика дохода" присутствует', async ({ page }) => {
    await expect(page.getByText('Динамика дохода')).toBeVisible()
  })

  test('навигация назад — показывает предыдущий месяц', async ({ page }) => {
    const prevLabel = format(subMonths(new Date(), 1), 'LLLL yyyy', { locale: ru })
    await page.getByRole('button', { name: '‹' }).click()
    await expect(page.getByText(prevLabel)).toBeVisible()
  })

  test('навигация вперёд — показывает следующий месяц', async ({ page }) => {
    const nextLabel = format(addMonths(new Date(), 1), 'LLLL yyyy', { locale: ru })
    await page.getByRole('button', { name: '›' }).click()
    await expect(page.getByText(nextLabel)).toBeVisible()
  })
})
