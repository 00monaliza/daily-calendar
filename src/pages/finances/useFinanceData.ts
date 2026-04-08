import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { eachMonthOfInterval, endOfMonth, format, getDaysInMonth, startOfMonth, subMonths } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { Property } from '@/entities/property/types'
import { supabase } from '@/shared/api/supabaseClient'
import {
  EXPENSE_CATEGORY_LABEL_ORDER,
  getExpenseCategoryLabelFromExpense,
} from './constants'

interface BookingFinance {
  id: string
  property_id: string | null
  check_in: string
  check_out: string
  total_price: number
  properties: {
    name: string
    color: string
  } | null
}

interface ExpenseFinance {
  id: string
  property_id: string | null
  amount: number
  category: string | null
  description: string | null
  date: string
  properties: {
    name: string
    color: string
  } | null
}

export interface PropertyFinanceStat {
  property: Property
  income: number
  expenseTotal: number
  expensesByCategory: Record<string, number>
  bookedDays: number
  occupancy: number
  netProfit: number
  margin: number | null
  status: 'Топ' | 'Норма' | 'Убыток'
}

interface FinanceHistoryItem {
  monthKey: string
  monthLabel: string
  income: number
  expenses: number
  netProfit: number
}

export interface ExpenseBreakdownItem {
  propertyId: string
  propertyName: string
  total: number
  [category: string]: number | string
}

interface FinanceDataResult {
  monthStart: string
  monthEnd: string
  properties: Property[]
  bookings: BookingFinance[]
  expenses: ExpenseFinance[]
  propertyStats: PropertyFinanceStat[]
  history: FinanceHistoryItem[]
  expenseCategories: string[]
  expenseBreakdown: ExpenseBreakdownItem[]
  totalIncome: number
  totalExpenses: number
  totalNetProfit: number
  totalMargin: number | null
  averageIncomePerProperty: number
  averageOccupancy: number
}

function normalizeCategory(
  categoryValue: string | null | undefined,
  description: string | null | undefined,
): string {
  return getExpenseCategoryLabelFromExpense(categoryValue, description)
}

export function countBookedDays(
  bookings: Array<Pick<BookingFinance, 'check_in' | 'check_out'>>,
  monthStart: string,
  monthEnd: string,
): number {
  const bookedDates = new Set<string>()

  bookings.forEach(booking => {
    const current = new Date(`${booking.check_in}T00:00:00`)
    const end = new Date(`${booking.check_out}T00:00:00`)

    while (current < end) {
      const dateStr = format(current, 'yyyy-MM-dd')
      if (dateStr >= monthStart && dateStr <= monthEnd) {
        bookedDates.add(dateStr)
      }
      current.setDate(current.getDate() + 1)
    }
  })

  return bookedDates.size
}

function buildEmptyFinanceData(month: Date): FinanceDataResult {
  const monthStart = format(startOfMonth(month), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(month), 'yyyy-MM-dd')
  const historyMonths = eachMonthOfInterval({
    start: startOfMonth(subMonths(month, 5)),
    end: startOfMonth(month),
  })

  return {
    monthStart,
    monthEnd,
    properties: [],
    bookings: [],
    expenses: [],
    propertyStats: [],
    history: historyMonths.map(m => ({
      monthKey: format(m, 'yyyy-MM'),
      monthLabel: format(m, 'LLL', { locale: ru }),
      income: 0,
      expenses: 0,
      netProfit: 0,
    })),
    expenseCategories: [],
    expenseBreakdown: [],
    totalIncome: 0,
    totalExpenses: 0,
    totalNetProfit: 0,
    totalMargin: null,
    averageIncomePerProperty: 0,
    averageOccupancy: 0,
  }
}

export function useFinanceData(month: Date, ownerId: string) {
  const monthKey = format(month, 'yyyy-MM')

  return useQuery({
    queryKey: ['finance-data', ownerId, monthKey],
    enabled: Boolean(ownerId),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<FinanceDataResult> => {
      if (!ownerId) return buildEmptyFinanceData(month)

      const monthStart = format(startOfMonth(month), 'yyyy-MM-dd')
      const monthEnd = format(endOfMonth(month), 'yyyy-MM-dd')
      const historyStart = format(startOfMonth(subMonths(month, 5)), 'yyyy-MM-dd')

      const [bookingsResult, expensesResult, propertiesResult, bookingsHistoryResult, expensesHistoryResult] =
        await Promise.all([
          supabase
            .from('bookings')
            .select('*, properties(name, color)')
            .eq('owner_id', ownerId)
            .gte('check_in', monthStart)
            .lte('check_in', monthEnd),
          supabase
            .from('expenses')
            .select('*, properties(name, color)')
            .eq('owner_id', ownerId)
            .gte('date', monthStart)
            .lte('date', monthEnd),
          supabase
            .from('properties')
            .select('*')
            .eq('owner_id', ownerId)
            .eq('is_active', true)
            .order('sort_order'),
          supabase
            .from('bookings')
            .select('id, property_id, check_in, check_out, total_price')
            .eq('owner_id', ownerId)
            .gte('check_in', historyStart)
            .lte('check_in', monthEnd),
          supabase
            .from('expenses')
            .select('id, property_id, amount, category, date')
            .eq('owner_id', ownerId)
            .gte('date', historyStart)
            .lte('date', monthEnd),
        ])

      const queryError =
        bookingsResult.error ??
        expensesResult.error ??
        propertiesResult.error ??
        bookingsHistoryResult.error ??
        expensesHistoryResult.error

      if (queryError) throw queryError

      const bookings = (bookingsResult.data ?? []) as BookingFinance[]
      const expenses = (expensesResult.data ?? []) as ExpenseFinance[]
      const properties = (propertiesResult.data ?? []) as Property[]
      const bookingsHistory = (bookingsHistoryResult.data ?? []) as Pick<
        BookingFinance,
        'id' | 'property_id' | 'check_in' | 'check_out' | 'total_price'
      >[]
      const expensesHistory = (expensesHistoryResult.data ?? []) as Pick<
        ExpenseFinance,
        'id' | 'property_id' | 'amount' | 'category' | 'date'
      >[]

      const totalDays = getDaysInMonth(month)

      const propertyStats: PropertyFinanceStat[] = properties.map(property => {
        const propertyBookings = bookings.filter(b => b.property_id === property.id)
        const propertyExpenses = expenses.filter(e => e.property_id === property.id)

        const income = propertyBookings.reduce((sum, booking) => sum + booking.total_price, 0)
        const expenseTotal = propertyExpenses.reduce((sum, expense) => sum + expense.amount, 0)

        const expensesByCategory = propertyExpenses.reduce<Record<string, number>>((acc, expense) => {
          const category = normalizeCategory(expense.category, expense.description)
          acc[category] = (acc[category] ?? 0) + expense.amount
          return acc
        }, {})

        const bookedDays = countBookedDays(propertyBookings, monthStart, monthEnd)
        const occupancy = totalDays > 0 ? Math.round((bookedDays / totalDays) * 100) : 0

        const netProfit = income - expenseTotal
        const margin = income > 0 ? Math.round((netProfit / income) * 100) : null

        const status: PropertyFinanceStat['status'] =
          netProfit < 0
            ? 'Убыток'
            : margin !== null && margin >= 50 && occupancy >= 60
              ? 'Топ'
              : 'Норма'

        return {
          property,
          income,
          expenseTotal,
          expensesByCategory,
          bookedDays,
          occupancy,
          netProfit,
          margin,
          status,
        }
      })

      const totalIncome = bookings.reduce((sum, booking) => sum + booking.total_price, 0)
      const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0)
      const totalNetProfit = totalIncome - totalExpenses
      const totalMargin = totalIncome > 0 ? Number(((totalNetProfit / totalIncome) * 100).toFixed(1)) : null

      const averageIncomePerProperty =
        properties.length > 0 ? Math.round(totalIncome / properties.length) : 0

      const averageOccupancy =
        propertyStats.length > 0
          ? Math.round(
              propertyStats.reduce((sum, stat) => sum + stat.occupancy, 0) / propertyStats.length,
            )
          : 0

      const historyMonths = eachMonthOfInterval({
        start: startOfMonth(subMonths(month, 5)),
        end: startOfMonth(month),
      })

      const history: FinanceHistoryItem[] = historyMonths.map(historyMonth => {
        const key = format(historyMonth, 'yyyy-MM')
        const income = bookingsHistory
          .filter(booking => booking.check_in.startsWith(key))
          .reduce((sum, booking) => sum + booking.total_price, 0)

        const expenseValue = expensesHistory
          .filter(expense => expense.date.startsWith(key))
          .reduce((sum, expense) => sum + expense.amount, 0)

        return {
          monthKey: key,
          monthLabel: format(historyMonth, 'LLL', { locale: ru }),
          income,
          expenses: expenseValue,
          netProfit: income - expenseValue,
        }
      })

      const expenseCategories = Array.from(
        new Set(propertyStats.flatMap(stat => Object.keys(stat.expensesByCategory))),
      ).sort((a, b) => {
        const categoryOrder = EXPENSE_CATEGORY_LABEL_ORDER as readonly string[]
        const indexA = categoryOrder.indexOf(a)
        const indexB = categoryOrder.indexOf(b)

        if (indexA === -1 && indexB === -1) return a.localeCompare(b, 'ru')
        if (indexA === -1) return 1
        if (indexB === -1) return -1
        return indexA - indexB
      })

      const expenseBreakdown: ExpenseBreakdownItem[] = propertyStats
        .filter(stat => stat.expenseTotal > 0)
        .map(stat => ({
          propertyId: stat.property.id,
          propertyName: stat.property.name,
          total: stat.expenseTotal,
          ...stat.expensesByCategory,
        }))

      return {
        monthStart,
        monthEnd,
        properties,
        bookings,
        expenses,
        propertyStats,
        history,
        expenseCategories,
        expenseBreakdown,
        totalIncome,
        totalExpenses,
        totalNetProfit,
        totalMargin,
        averageIncomePerProperty,
        averageOccupancy,
      }
    },
  })
}
