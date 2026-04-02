import React, { useRef, useEffect } from 'react'
import { format, eachDayOfInterval, parseISO, isToday, isSameDay, differenceInCalendarDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { Property } from '@/entities/property/types'
import type { Booking, BookingWithProperty } from '@/entities/booking/types'
import { useSettings } from '@/entities/settings/queries'

const COL_WIDTH = 36

interface Props {
  properties: Property[]
  bookings: (Booking | BookingWithProperty)[]
  from: string
  to: string
  onCellClick: (date: string, propertyId: string) => void
  onBookingClick: (booking: Booking) => void
  onLoadPrev: () => void
  onLoadNext: () => void
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 55, g: 110, b: 111 }
}

export function ChessGrid({
  properties,
  bookings,
  from,
  to,
  onCellClick,
  onBookingClick,
  onLoadPrev,
  onLoadNext,
  scrollContainerRef,
}: Props) {
  const { data: settings } = useSettings()
  const showFullText = settings?.show_full_text ?? true
  const rowHeightClass = settings?.compact_mode ? 'h-7' : 'h-10'

  const leftSentinelRef = useRef<HTMLTableCellElement>(null)
  const rightSentinelRef = useRef<HTMLTableCellElement>(null)

  // NOTE: onLoadPrev and onLoadNext must be stable references (useCallback with empty deps
  // or module-level functions) — otherwise this observer disconnects and reconnects on every
  // render, causing spurious load triggers when both sentinels are briefly visible.
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container || !leftSentinelRef.current || !rightSentinelRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          if (entry.target === leftSentinelRef.current) onLoadPrev()
          if (entry.target === rightSentinelRef.current) onLoadNext()
        }
      },
      { root: container, threshold: 0.1 }
    )

    observer.observe(leftSentinelRef.current)
    observer.observe(rightSentinelRef.current)

    return () => observer.disconnect()
  }, [onLoadPrev, onLoadNext, scrollContainerRef])

  const days = eachDayOfInterval({
    start: parseISO(from),
    end: parseISO(to),
  })

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
    <div ref={scrollContainerRef} className="overflow-auto flex-1">
      <table className="border-collapse" style={{ minWidth: 'max-content' }}>
        <thead>
          <tr>
            <th
              ref={leftSentinelRef}
              style={{ width: 1, minWidth: 1, padding: 0, border: 'none' }}
              aria-hidden="true"
            />
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
            <th
              ref={rightSentinelRef}
              style={{ width: 1, minWidth: 1, padding: 0, border: 'none' }}
              aria-hidden="true"
            />
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

                    let textOverlay: React.ReactNode = null
                    if (isStart) {
                      const checkOut = parseISO(booking.check_out)
                      const rangeEnd = parseISO(to)
                      const effectiveEnd = checkOut <= rangeEnd ? checkOut : rangeEnd
                      const spanDays = Math.max(1, differenceInCalendarDays(effectiveEnd, day) + 1)
                      const textWidth = spanDays * COL_WIDTH - 6
                      const tooltipText = [booking.guest_name, booking.comment].filter(Boolean).join(' — ')

                      textOverlay = (
                        <div
                          className="absolute top-0.5 bottom-0.5 left-[5px] z-10 flex flex-col justify-center px-1.5 py-0.5 pointer-events-none overflow-hidden"
                          style={{ width: `${textWidth}px` }}
                          title={tooltipText}
                        >
                          <span
                            className={showFullText ? 'text-xs font-medium leading-tight whitespace-normal break-words' : 'text-xs font-medium leading-tight truncate'}
                            style={{ color: property.color }}
                          >
                            {booking.guest_name}
                          </span>
                          {showFullText && booking.comment && (
                            <span className="text-[10px] text-gray-500 leading-tight whitespace-normal break-words mt-0.5 line-clamp-2">
                              {booking.comment}
                            </span>
                          )}
                        </div>
                      )
                    }

                    return (
                      <td
                        key={dateStr}
                        className={`border-b border-gray-100 ${rowHeightClass} p-0 cursor-pointer relative overflow-visible ${today ? 'border-l-2 border-l-[#376E6F]' : ''}`}
                        onClick={() => onBookingClick(booking)}
                      >
                        <div
                          className="absolute inset-y-0.5"
                          style={{
                            left: isStart ? '2px' : '0',
                            right: isEnd ? '2px' : '0',
                            backgroundColor: `rgba(${rgb.r},${rgb.g},${rgb.b},0.15)`,
                            borderLeft: isStart ? `3px solid ${property.color}` : 'none',
                            borderRadius: isStart ? '4px 0 0 4px' : isEnd ? '0 4px 4px 0' : '0',
                          }}
                        />
                        {textOverlay}
                      </td>
                    )
                  }

                  return (
                    <td
                      key={dateStr}
                      className={`border border-gray-200 ${rowHeightClass} cursor-pointer hover:bg-[#376E6F]/10 transition-colors ${today ? 'border-l-2 border-l-[#376E6F] bg-[#376E6F]/5' : ''}`}
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
