import { useState } from 'react'
import { differenceInCalendarMonths } from 'date-fns'
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { useUser } from '@/features/auth/useUser'
import { useGuests } from '@/entities/guest/queries'
import { formatMoney } from '@/shared/lib/formatMoney'

const PIE_COLORS = ['#376E6F', '#5e81ea', '#F5A623', '#E05C5C', '#7EC8E3', '#C3A6E8', '#7BC67E', '#9CA3AF']

type RawBooking = {
  guest_name: string
  guest_phone: string | null
  check_in: string
  check_out: string
  total_price: number
  payment_status: string
  properties: { name: string } | null
}

interface GuestStats {
  totalBookings: number
  totalRevenue: number
  avgBookingsPerMonth: number
  byProperty: { name: string; value: number; count: number }[]
}

function computeGuestStats(bookings: RawBooking[]): GuestStats {
  const totalRevenue = bookings.reduce((sum, b) => sum + (b.total_price || 0), 0)
  const totalBookings = bookings.length

  const checkInTimes = bookings
    .map(b => new Date(b.check_in).getTime())
    .filter(t => !Number.isNaN(t))
  const monthsSpan = checkInTimes.length > 0
    ? differenceInCalendarMonths(new Date(Math.max(...checkInTimes)), new Date(Math.min(...checkInTimes))) + 1
    : 1
  const avgBookingsPerMonth = totalBookings / Math.max(1, monthsSpan)

  const propertyMap = new Map<string, { count: number; value: number }>()
  for (const b of bookings) {
    const name = b.properties?.name ?? 'Другое'
    const cur = propertyMap.get(name) ?? { count: 0, value: 0 }
    cur.count += 1
    cur.value += b.total_price || 0
    propertyMap.set(name, cur)
  }
  const byProperty = Array.from(propertyMap.entries()).map(([name, v]) => ({ name, value: v.value, count: v.count }))

  return { totalRevenue, totalBookings, avgBookingsPerMonth, byProperty }
}

function GuestStatsPanel({ bookings }: { bookings: RawBooking[] }) {
  const stats = computeGuestStats(bookings)

  return (
    <div className="mb-4">
      <h4 className="text-xs font-medium text-gray-500 mb-2">Статистика</h4>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <div className="text-sm font-bold text-gray-800">{stats.totalBookings}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">Всего броней</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <div className="text-sm font-bold text-gray-800">{stats.avgBookingsPerMonth.toFixed(1)}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">Броней / мес.</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <div className="text-sm font-bold text-[#376E6F]">{formatMoney(stats.totalRevenue)}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">Принёс дохода</div>
        </div>
      </div>

      {stats.byProperty.length > 1 && (
        <div>
          <div className="text-[10px] text-gray-500 mb-1">Доход по квартирам</div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={stats.byProperty}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={65}
                paddingAngle={2}
              >
                {stats.byProperty.map((entry, i) => (
                  <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value, _name, item) => [formatMoney(Number(value ?? 0)), `${item?.payload?.name} (${item?.payload?.count})`]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export function GuestsPage() {
  const { user } = useUser()
  const { data: rawBookings = [], isLoading } = useGuests(user?.id)
  const [search, setSearch] = useState('')
  const [selectedGuest, setSelectedGuest] = useState<string | null>(null)

  const bookings = rawBookings as unknown as RawBooking[]

  // Group by guest
  const guestMap = new Map<string, RawBooking[]>()
  for (const b of bookings) {
    if (!guestMap.has(b.guest_name)) guestMap.set(b.guest_name, [])
    guestMap.get(b.guest_name)!.push(b)
  }

  const guests = Array.from(guestMap.entries()).map(([name, bks]) => ({
    name,
    phone: bks[0].guest_phone,
    count: bks.length,
    lastCheckIn: bks[0].check_in,
    bookings: bks,
  }))

  const filtered = guests.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    (g.phone && g.phone.includes(search))
  )

  const selectedGuestData = filtered.find(g => g.name === selectedGuest)

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">База гостей</h1>

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#376E6F] mb-4"
        placeholder="Поиск по имени или телефону..."
      />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-[#376E6F] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
        {/* Mobile: accordion cards */}
        <div className="md:hidden space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center text-gray-400 text-sm py-8">Гостей не найдено</div>
          ) : filtered.map(guest => (
            <div key={guest.name} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                className="w-full px-4 py-3 flex items-center justify-between text-left min-h-[56px]"
                onClick={() => setSelectedGuest(guest.name === selectedGuest ? null : guest.name)}
              >
                <div>
                  <div className="font-medium text-sm text-gray-800">{guest.name}</div>
                  {guest.phone && <div className="text-xs text-gray-400">{guest.phone}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{guest.count} броней</span>
                  <span className="text-gray-400 text-sm">{selectedGuest === guest.name ? '▴' : '▾'}</span>
                </div>
              </button>
              {selectedGuest === guest.name && (
                <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                  <GuestStatsPanel bookings={guest.bookings} />
                  <h4 className="text-xs font-medium text-gray-500 mb-2">История броней</h4>
                  <div className="space-y-2">
                    {guest.bookings.map((b, i) => (
                      <div key={i} className="border border-gray-200 rounded-lg p-2 bg-white">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-700">{b.properties?.name ?? '—'}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            b.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                            b.payment_status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {b.payment_status === 'paid' ? 'Оплачено' : b.payment_status === 'partial' ? 'Частично' : 'Ожидает'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{b.check_in} → {b.check_out}</div>
                        <div className="text-xs font-medium text-[#376E6F]">{b.total_price.toLocaleString()} ₸</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Desktop: original table + side panel */}
        <div className="hidden md:grid gap-4 md:grid-cols-2">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Гость</th>
                  <th className="text-center text-xs text-gray-500 font-medium px-4 py-3">Броней</th>
                  <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">Последний заезд</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center text-gray-400 text-sm py-8">Гостей не найдено</td>
                  </tr>
                ) : filtered.map(guest => (
                  <tr
                    key={guest.name}
                    className={`border-b border-gray-100 last:border-0 cursor-pointer transition-colors ${selectedGuest === guest.name ? 'bg-[#376E6F]/5' : 'hover:bg-gray-50'}`}
                    onClick={() => setSelectedGuest(guest.name === selectedGuest ? null : guest.name)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-sm text-gray-800">{guest.name}</div>
                      {guest.phone && <div className="text-xs text-gray-400">{guest.phone}</div>}
                    </td>
                    <td className="text-center px-4 py-3 text-sm text-gray-600">{guest.count}</td>
                    <td className="text-right px-4 py-3 text-xs text-gray-400">{guest.lastCheckIn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedGuestData && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-800 mb-1">{selectedGuestData.name}</h3>
              {selectedGuestData.phone && (
                <p className="text-sm text-gray-500 mb-3">{selectedGuestData.phone}</p>
              )}
              <GuestStatsPanel bookings={selectedGuestData.bookings} />
              <h4 className="text-xs font-medium text-gray-500 mb-2">История броней</h4>
              <div className="space-y-2">
                {selectedGuestData.bookings.map((b, i) => (
                  <div key={i} className="border border-gray-100 rounded-lg p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-700">
                        {b.properties?.name ?? '—'}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        b.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                        b.payment_status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {b.payment_status === 'paid' ? 'Оплачено' : b.payment_status === 'partial' ? 'Частично' : 'Ожидает'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {b.check_in} → {b.check_out}
                    </div>
                    <div className="text-xs font-medium text-[#376E6F]">{b.total_price.toLocaleString()} ₸</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        </>
      )}
    </div>
  )
}
