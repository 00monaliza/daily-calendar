import { differenceInDays } from 'date-fns'
import type { Booking, BookingWithProperty } from '@/entities/booking/types'
import type { Property } from '@/entities/property/types'

interface Props {
  bookings: (Booking | BookingWithProperty)[]
  properties: Property[]
  from: string
  to: string
}

export function SummaryBar({ bookings, properties, from, to }: Props) {
  const daysInPeriod = differenceInDays(new Date(to), new Date(from)) + 1
  const totalPropertyDays = properties.length * daysInPeriod

  const bookedDays = bookings.reduce((acc, b) => {
    const checkIn = new Date(b.check_in)
    const checkOut = new Date(b.check_out)
    const periodStart = new Date(from)
    const periodEnd = new Date(to)
    const start = checkIn < periodStart ? periodStart : checkIn
    const end = checkOut > periodEnd ? periodEnd : checkOut
    const days = differenceInDays(end, start)
    return acc + Math.max(0, days)
  }, 0)

  const occupancy = totalPropertyDays > 0
    ? Math.round((bookedDays / totalPropertyDays) * 100)
    : 0

  const income = bookings.reduce((acc, b) => acc + b.total_price, 0)
  const freeNights = totalPropertyDays - bookedDays

  const metrics = [
    { label: 'Загруженность', value: `${occupancy}%`, color: 'text-[#376E6F]' },
    { label: 'Доход за период', value: `${income.toLocaleString()} ₸`, color: 'text-emerald-600' },
    { label: 'Активных броней', value: bookings.length.toString(), color: 'text-blue-600' },
    { label: 'Свободных ночей', value: Math.max(0, freeNights).toString(), color: 'text-gray-600' },
  ]

  return (
    <div className="grid grid-cols-4 gap-4 px-4 py-3 bg-white border-b border-gray-200">
      {metrics.map(m => (
        <div key={m.label} className="flex flex-col">
          <span className="text-xs text-gray-500 mb-0.5">{m.label}</span>
          <span className={`text-xl font-bold ${m.color}`}>{m.value}</span>
        </div>
      ))}
    </div>
  )
}
