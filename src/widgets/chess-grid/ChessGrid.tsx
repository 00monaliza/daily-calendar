import { format, eachDayOfInterval, startOfMonth, endOfMonth, isToday, parseISO, isSameDay } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { Property } from '@/entities/property/types'
import type { Booking, BookingWithProperty } from '@/entities/booking/types'

interface Props {
  properties: Property[]
  bookings: (Booking | BookingWithProperty)[]
  currentMonth: Date
  onCellClick: (date: string, propertyId: string) => void
  onBookingClick: (booking: Booking) => void
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 55, g: 110, b: 111 }
}

export function ChessGrid({ properties, bookings, currentMonth, onCellClick, onBookingClick }: Props) {
  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  })

  // Build lookup: propertyId -> date -> booking
  const bookingMap = new Map<string, Map<string, Booking>>()
  for (const booking of bookings) {
    if (!bookingMap.has(booking.property_id)) {
      bookingMap.set(booking.property_id, new Map())
    }
    const propMap = bookingMap.get(booking.property_id)!
    const checkIn = parseISO(booking.check_in)
    const checkOut = parseISO(booking.check_out)
    for (const day of eachDayOfInterval({ start: checkIn, end: checkOut })) {
      const key = format(day, 'yyyy-MM-dd')
      propMap.set(key, booking as Booking)
    }
  }

  if (properties.length === 0) {
    return (
      <div className="flex items-center justify-center flex-1 text-gray-400 text-sm py-16">
        Добавьте квартиры, чтобы увидеть шахматку
      </div>
    )
  }

  return (
    <div className="overflow-auto flex-1">
      <table className="border-collapse" style={{ minWidth: 'max-content' }}>
        <thead>
          <tr>
            <th className="sticky left-0 z-20 bg-white border-b border-r border-gray-200 px-3 py-2 text-left text-xs text-gray-500 font-medium min-w-[160px]">
              Квартира
            </th>
            {days.map(day => {
              const today = isToday(day)
              return (
                <th
                  key={day.toISOString()}
                  className={`border-b border-gray-200 px-1 py-1 text-center min-w-[36px] ${today ? 'bg-[#376E6F]/10' : 'bg-white'}`}
                >
                  <div className={`text-xs font-medium ${today ? 'text-[#376E6F]' : 'text-gray-400'}`}>
                    {format(day, 'EEE', { locale: ru }).slice(0, 2)}
                  </div>
                  <div className={`text-sm font-bold ${today ? 'text-[#376E6F]' : 'text-gray-700'}`}>
                    {format(day, 'd')}
                  </div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {properties.map(property => {
            const propBookings = bookingMap.get(property.id) ?? new Map<string, Booking>()
            const rgb = hexToRgb(property.color)

            return (
              <tr key={property.id} className="group">
                <td className="sticky left-0 z-10 bg-white border-b border-r border-gray-200 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: property.color }}
                    />
                    <span className="text-sm font-medium text-gray-800 truncate max-w-[120px]">
                      {property.name}
                    </span>
                  </div>
                </td>
                {days.map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd')
                  const booking = propBookings.get(dateStr)
                  const today = isToday(day)

                  if (booking) {
                    const isStart = isSameDay(parseISO(booking.check_in), day)
                    const isEnd = isSameDay(parseISO(booking.check_out), day)

                    return (
                      <td
                        key={dateStr}
                        className={`border-b border-gray-100 h-10 p-0 cursor-pointer relative ${today ? 'border-l-2 border-l-[#376E6F]' : ''}`}
                        onClick={() => onBookingClick(booking)}
                      >
                        <div
                          className="absolute inset-y-0.5 flex items-center overflow-hidden"
                          style={{
                            left: isStart ? '2px' : '0',
                            right: isEnd ? '2px' : '0',
                            backgroundColor: `rgba(${rgb.r},${rgb.g},${rgb.b},0.15)`,
                            borderLeft: isStart ? `3px solid ${property.color}` : 'none',
                            borderRadius: isStart ? '4px 0 0 4px' : isEnd ? '0 4px 4px 0' : '0',
                          }}
                        >
                          {isStart && (
                            <span
                              className="text-xs font-medium px-1 truncate"
                              style={{ color: property.color }}
                            >
                              {booking.guest_name}
                            </span>
                          )}
                        </div>
                      </td>
                    )
                  }

                  return (
                    <td
                      key={dateStr}
                      className={`border-b border-gray-100 h-10 cursor-pointer hover:bg-gray-50 transition-colors ${today ? 'border-l-2 border-l-[#376E6F] bg-[#376E6F]/5' : ''}`}
                      onClick={() => onCellClick(dateStr, property.id)}
                    />
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
