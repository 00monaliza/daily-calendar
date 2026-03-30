import { useState } from 'react'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { ru } from 'date-fns/locale'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useUser } from '@/features/auth/useUser'
import { useProperties } from '@/entities/property/queries'
import { useBookings } from '@/entities/booking/queries'
import { useExpenses } from '@/entities/expenses/queries'

export function FinancesPage() {
  const { user } = useUser()
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const from = format(startOfMonth(currentMonth), 'yyyy-MM-dd')
  const to = format(endOfMonth(currentMonth), 'yyyy-MM-dd')

  const { data: properties = [] } = useProperties(user?.id)
  const { data: bookings = [] } = useBookings(user?.id, from, to)
  const { data: expenses = [] } = useExpenses(user?.id, from, to)

  // Per-property stats
  const stats = properties.map(property => {
    const propBookings = bookings.filter(b => b.property_id === property.id)
    const propExpenses = expenses.filter((e: { property_id: string | null }) => e.property_id === property.id)
    const income = propBookings.reduce((s, b) => s + b.total_price, 0)
    const expTotal = propExpenses.reduce((s: number, e: { amount: number }) => s + e.amount, 0)
    return {
      property,
      income,
      expenses: expTotal,
      profit: income - expTotal,
    }
  })

  const totalIncome = stats.reduce((s, r) => s + r.income, 0)
  const totalExpenses = stats.reduce((s, r) => s + r.expenses, 0)
  const totalProfit = totalIncome - totalExpenses

  // Simple 6-month chart data
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const month = subMonths(currentMonth, 5 - i)
    return {
      name: format(month, 'MMM', { locale: ru }),
      доход: bookings
        .filter(b => b.check_in.startsWith(format(month, 'yyyy-MM')))
        .reduce((s, b) => s + b.total_price, 0),
    }
  })

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setCurrentMonth(m => subMonths(m, 1))}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
        >
          ‹
        </button>
        <h1 className="text-2xl font-bold text-gray-800">
          {format(currentMonth, 'LLLL yyyy', { locale: ru })}
        </h1>
        <button
          onClick={() => setCurrentMonth(m => {
            const next = new Date(m)
            next.setMonth(next.getMonth() + 1)
            return next
          })}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Доход', value: totalIncome, color: 'text-emerald-600' },
          { label: 'Расходы', value: totalExpenses, color: 'text-red-500' },
          { label: 'Прибыль', value: totalProfit, color: totalProfit >= 0 ? 'text-[#376E6F]' : 'text-red-600' },
        ].map(m => (
          <div key={m.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs text-gray-500 mb-1">{m.label}</div>
            <div className={`text-2xl font-bold ${m.color}`}>{m.value.toLocaleString()} ₸</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Динамика дохода</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v) => [`${Number(v).toLocaleString()} ₸`, 'Доход']} />
            <Line type="monotone" dataKey="доход" stroke="#376E6F" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Квартира</th>
              <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">Доход</th>
              <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">Расходы</th>
              <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">Прибыль</th>
            </tr>
          </thead>
          <tbody>
            {stats.map(row => (
              <tr key={row.property.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: row.property.color }} />
                    <span className="text-sm font-medium text-gray-800">{row.property.name}</span>
                  </div>
                </td>
                <td className="text-right px-4 py-3 text-sm text-emerald-600">{row.income.toLocaleString()} ₸</td>
                <td className="text-right px-4 py-3 text-sm text-red-500">{row.expenses.toLocaleString()} ₸</td>
                <td className={`text-right px-4 py-3 text-sm font-medium ${row.profit >= 0 ? 'text-[#376E6F]' : 'text-red-600'}`}>
                  {row.profit.toLocaleString()} ₸
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
