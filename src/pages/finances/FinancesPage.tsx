import { useMemo, useState } from 'react'
import { addMonths, format, subMonths } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useUser } from '@/features/auth/useUser'
import { formatMoney } from '@/shared/lib/formatMoney'
import { ExpenseModal } from './ExpenseModal'
import { getExpenseCategoryColor } from './constants'
import { useFinanceData, type PropertyFinanceStat } from './useFinanceData'

type SortKey = 'property' | 'income' | 'expenseTotal' | 'netProfit' | 'margin' | 'occupancy' | 'status'
type SortDirection = 'asc' | 'desc'

interface SortState {
  key: SortKey
  direction: SortDirection
}

function getMarginColorClass(margin: number | null): string {
  if (margin === null) return 'text-gray-500'
  if (margin >= 50) return 'text-emerald-600'
  if (margin >= 30) return 'text-amber-600'
  return 'text-red-600'
}

function getMarginBadgeClass(margin: number | null): string {
  if (margin === null) return 'bg-gray-100 text-gray-500'
  if (margin >= 50) return 'bg-emerald-100 text-emerald-700'
  if (margin >= 30) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

function getStatusBadge(status: PropertyFinanceStat['status']): { label: string; className: string } {
  if (status === 'Топ') {
    return { label: '🏆 Топ', className: 'bg-emerald-100 text-emerald-700' }
  }
  if (status === 'Убыток') {
    return { label: '📉 Убыток', className: 'bg-red-100 text-red-700' }
  }
  return { label: '📊 Норма', className: 'bg-slate-100 text-slate-700' }
}

function formatTooltipMoney(
  value: number | string | Array<number | string> | ReadonlyArray<number | string> | undefined,
): string {
  if (Array.isArray(value)) {
    return formatMoney(Number(value[0] ?? 0))
  }
  return formatMoney(Number(value ?? 0))
}

export function FinancesPage() {
  const { user } = useUser()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [sort, setSort] = useState<SortState>({ key: 'netProfit', direction: 'desc' })
  const [expensePopoverPropertyId, setExpensePopoverPropertyId] = useState<string | null>(null)
  const [isExpenseModalOpen, setExpenseModalOpen] = useState(false)
  const [expenseModalPropertyId, setExpenseModalPropertyId] = useState<string | null>(null)

  const ownerId = user?.id ?? ''

  const { data, isLoading, isError, error } = useFinanceData(currentMonth, ownerId)

  const sortedStats = useMemo(() => {
    const rows = [...(data?.propertyStats ?? [])]
    const statusWeight: Record<PropertyFinanceStat['status'], number> = {
      Топ: 3,
      Норма: 2,
      Убыток: 1,
    }

    rows.sort((a, b) => {
      let result = 0

      switch (sort.key) {
        case 'property':
          result = a.property.name.localeCompare(b.property.name, 'ru')
          break
        case 'income':
          result = a.income - b.income
          break
        case 'expenseTotal':
          result = a.expenseTotal - b.expenseTotal
          break
        case 'netProfit':
          result = a.netProfit - b.netProfit
          break
        case 'margin':
          result = (a.margin ?? Number.NEGATIVE_INFINITY) - (b.margin ?? Number.NEGATIVE_INFINITY)
          break
        case 'occupancy':
          result = a.occupancy - b.occupancy
          break
        case 'status':
          result = statusWeight[a.status] - statusWeight[b.status]
          break
      }

      if (result === 0) {
        result = a.netProfit - b.netProfit
      }

      return sort.direction === 'asc' ? result : -result
    })

    return rows
  }, [data?.propertyStats, sort])

  function updateSort(key: SortKey) {
    setSort(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      }
      return {
        key,
        direction: key === 'property' ? 'asc' : 'desc',
      }
    })
  }

  function openExpenseModal(propertyId: string | null = null) {
    setExpensePopoverPropertyId(null)
    setExpenseModalPropertyId(propertyId)
    setExpenseModalOpen(true)
  }

  function closeExpenseModal() {
    setExpenseModalOpen(false)
    setExpenseModalPropertyId(null)
  }

  function renderSortLabel(label: string, key: SortKey) {
    const isActive = sort.key === key
    const arrow = !isActive ? '↕' : sort.direction === 'asc' ? '▲' : '▼'

    return (
      <button
        type="button"
        onClick={() => updateSort(key)}
        className={`inline-flex items-center gap-1 hover:text-gray-800 ${isActive ? 'text-gray-800' : ''}`}
      >
        <span>{label}</span>
        <span className="text-[10px] leading-none">{arrow}</span>
      </button>
    )
  }

  if (!ownerId || (isLoading && !data)) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-[#2D9D8F] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
          Не удалось загрузить финансы: {error instanceof Error ? error.message : 'неизвестная ошибка'}
        </div>
      </div>
    )
  }

  const totalMargin = data?.totalMargin ?? null
  const hasNoExpenses = (data?.totalExpenses ?? 0) === 0
  const occupancyPercent = Math.max(0, Math.min(data?.averageOccupancy ?? 0, 100))

  const marginIndicator =
    totalMargin === null ? '⚪' : totalMargin >= 50 ? '🟢' : totalMargin >= 30 ? '🟠' : '🔴'

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setCurrentMonth(m => subMonths(m, 1))}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
        >
          {'<'}
        </button>
        <h1 className="text-2xl font-bold text-gray-800">
          {format(currentMonth, 'LLLL yyyy', { locale: ru })}
        </h1>
        <button
          onClick={() => setCurrentMonth(m => addMonths(m, 1))}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
        >
          {'>'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">Валовый доход</div>
          <div className="text-xl md:text-2xl font-bold text-emerald-600">
            {formatMoney(data?.totalIncome ?? 0)}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">Расходы</div>
          <div className={`text-xl md:text-2xl font-bold ${(data?.totalExpenses ?? 0) > 0 ? 'text-red-600' : 'text-gray-500'}`}>
            {formatMoney(data?.totalExpenses ?? 0)}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">Чистая прибыль</div>
          <div className={`text-xl md:text-2xl font-bold ${(data?.totalNetProfit ?? 0) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            {formatMoney(data?.totalNetProfit ?? 0)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">Маржа</div>
          <div className={`text-xl md:text-2xl font-bold ${getMarginColorClass(totalMargin)}`}>
            {totalMargin === null ? '—' : `${totalMargin}%`}
          </div>
          <div className={`text-xs mt-2 font-medium ${getMarginColorClass(totalMargin)}`}>{marginIndicator}</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">Ср. доход/кв.</div>
          <div className="text-xl md:text-2xl font-bold text-[#2D9D8F]">
            {formatMoney(data?.averageIncomePerProperty ?? 0)}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">Ср. загрузка</div>
          <div className="text-xl md:text-2xl font-bold text-[#2D9D8F]">{occupancyPercent}%</div>
          <div className="mt-2 h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#2D9D8F] transition-all"
              style={{ width: `${occupancyPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Динамика дохода</h2>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data?.history ?? []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={value => Number(value).toLocaleString('ru-RU')} />
            <Tooltip
              formatter={(value, name) => [formatTooltipMoney(value), String(name)]}
            />
            <Legend />
            <Bar dataKey="income" name="Доход" fill="#2D9D8F" fillOpacity={0.45} radius={[6, 6, 0, 0]} />
            <Bar dataKey="expenses" name="Расходы" fill="#DC2626" fillOpacity={0.35} radius={[6, 6, 0, 0]} />
            <Line
              type="monotone"
              dataKey="netProfit"
              name="Чистая прибыль"
              stroke="#2563EB"
              strokeWidth={3}
              dot={{ r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mb-6">
        {hasNoExpenses && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="text-sm text-amber-800">
              💡 Расходы не введены — прибыль отображается некорректно.
            </div>
            <button
              type="button"
              onClick={() => openExpenseModal(null)}
              className="text-sm font-medium text-amber-900 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg"
            >
              Добавить расходы
            </button>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 overflow-visible">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700">Квартиры</h2>
            <button
              type="button"
              onClick={() => openExpenseModal(null)}
              className="bg-[#2D9D8F] text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-[#257C71] transition-colors"
            >
              ＋ Добавить расход
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">{renderSortLabel('Квартира', 'property')}</th>
                  <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">{renderSortLabel('Доход', 'income')}</th>
                  <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">{renderSortLabel('Расходы', 'expenseTotal')}</th>
                  <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">{renderSortLabel('Чистая прибыль', 'netProfit')}</th>
                  <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">{renderSortLabel('Маржа %', 'margin')}</th>
                  <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">{renderSortLabel('Загрузка %', 'occupancy')}</th>
                  <th className="text-center text-xs text-gray-500 font-medium px-4 py-3">{renderSortLabel('Статус', 'status')}</th>
                </tr>
              </thead>
              <tbody>
                {sortedStats.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-gray-400 text-sm py-10">
                      Нет активных квартир для отображения
                    </td>
                  </tr>
                ) : (
                  sortedStats.map(row => {
                    const statusBadge = getStatusBadge(row.status)

                    return (
                      <tr key={row.property.id} className="border-b border-gray-100 last:border-0">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: row.property.color }} />
                            <span className="text-sm font-medium text-gray-800">{row.property.name}</span>
                          </div>
                        </td>

                        <td className="text-right px-4 py-3 text-sm text-emerald-600 font-medium">
                          {formatMoney(row.income)}
                        </td>

                        <td className="text-right px-4 py-3 text-sm text-red-600 relative">
                          {row.expenseTotal > 0 ? (
                            <>
                              <button
                                type="button"
                                className="hover:underline"
                                onClick={() => {
                                  setExpensePopoverPropertyId(prev =>
                                    prev === row.property.id ? null : row.property.id,
                                  )
                                }}
                              >
                                {formatMoney(row.expenseTotal)}
                              </button>
                              {expensePopoverPropertyId === row.property.id && (
                                <div className="absolute right-2 top-full mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-20 p-3 text-left">
                                  <div className="text-xs font-semibold text-gray-700 mb-2">Расходы по категориям</div>
                                  <div className="space-y-1.5">
                                    {Object.entries(row.expensesByCategory)
                                      .sort((a, b) => b[1] - a[1])
                                      .map(([category, amount]) => (
                                        <div key={category} className="flex items-center justify-between text-xs">
                                          <span className="text-gray-600">{category}</span>
                                          <span className="font-medium text-gray-800">{formatMoney(amount)}</span>
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openExpenseModal(row.property.id)}
                              className="inline-flex items-center gap-1 text-red-500 hover:text-red-700"
                            >
                              <span>{formatMoney(0)}</span>
                              <span className="opacity-80" title="Расходы не указаны — прибыль неточная">⚠️</span>
                            </button>
                          )}
                        </td>

                        <td className={`text-right px-4 py-3 text-sm font-medium ${row.netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                          {formatMoney(row.netProfit)}
                        </td>

                        <td className="text-right px-4 py-3 text-sm">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${getMarginBadgeClass(row.margin)}`}>
                            {row.margin === null ? '—' : `${row.margin}%`}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 justify-end">
                            <div className="w-24 bg-gray-100 rounded-full h-2 overflow-hidden">
                              <div
                                className="h-full bg-[#2D9D8F]"
                                style={{ width: `${Math.max(0, Math.min(row.occupancy, 100))}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600 w-9 text-right">{row.occupancy}%</span>
                          </div>
                        </td>

                        <td className="text-center px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${statusBadge.className}`}>
                            {statusBadge.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Структура расходов</h2>
        {(data?.expenseBreakdown.length ?? 0) === 0 ? (
          <div className="text-sm text-gray-400 py-8 text-center">Нет расходов за выбранный месяц</div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(260, (data?.expenseBreakdown.length ?? 0) * 56)}>
            <BarChart layout="vertical" data={data?.expenseBreakdown ?? []} margin={{ left: 24, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tickFormatter={value => Number(value).toLocaleString('ru-RU')} />
              <YAxis type="category" dataKey="propertyName" width={180} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value, name) => [formatTooltipMoney(value), String(name)]}
              />
              <Legend />
              {(data?.expenseCategories ?? []).map(category => (
                <Bar
                  key={category}
                  dataKey={category}
                  stackId="expenses"
                  name={category}
                  fill={getExpenseCategoryColor(category)}
                  radius={[0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {isExpenseModalOpen && (
        <ExpenseModal
          open
          ownerId={ownerId}
          properties={data?.properties ?? []}
          prefillPropertyId={expenseModalPropertyId}
          defaultDate={currentMonth}
          onClose={closeExpenseModal}
        />
      )}
    </div>
  )
}
