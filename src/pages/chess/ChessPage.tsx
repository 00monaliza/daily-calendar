import { useState, useRef, useEffect, useCallback } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  parseISO,
  differenceInCalendarDays,
} from 'date-fns'
import { useUser } from '@/features/auth/useUser'
import { useProperties } from '@/entities/property/queries'
import { useBookings } from '@/entities/booking/queries'
import { SummaryBar } from '@/widgets/summary-bar/SummaryBar'
import { ChessGrid } from '@/widgets/chess-grid/ChessGrid'
import { BookingModal } from '@/widgets/booking-modal/BookingModal'
import type { Booking } from '@/entities/booking/types'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import { MobileChessGrid } from '@/widgets/chess-grid/MobileChessGrid'

const COL_WIDTH = 36
const EXTEND_MONTHS = 3
const MAX_WINDOW_MONTHS = 12

function initialWindow() {
  const now = new Date()
  return {
    from: format(subMonths(startOfMonth(now), 2), 'yyyy-MM-dd'),
    to: format(endOfMonth(addMonths(now, 2)), 'yyyy-MM-dd'),
  }
}

export function ChessPage() {
  const { user } = useUser()
  const isMobile = useIsMobile()

  const [from, setFrom] = useState(() => initialWindow().from)
  const [to, setTo] = useState(() => initialWindow().to)

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const isLoadingMoreRef = useRef(false)
  const prevFromRef = useRef(from)
  const isTeleportRef = useRef(false)
  const teleportTargetRef = useRef<string | null>(null)

  const extendPrev = useCallback(() => {
    if (isLoadingMoreRef.current) return
    isLoadingMoreRef.current = true
    setFrom(prev => format(subMonths(parseISO(prev), EXTEND_MONTHS), 'yyyy-MM-dd'))
  }, [])

  const extendNext = useCallback(() => {
    if (isLoadingMoreRef.current) return
    isLoadingMoreRef.current = true
    setTo(prev => format(endOfMonth(addMonths(parseISO(prev), EXTEND_MONTHS)), 'yyyy-MM-dd'))
  }, [])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (isTeleportRef.current || !container) {
      prevFromRef.current = from
      return
    }
    const daysDiff = differenceInCalendarDays(parseISO(from), parseISO(prevFromRef.current))
    if (daysDiff !== 0) {
      container.scrollLeft -= daysDiff * COL_WIDTH
    }
    prevFromRef.current = from
  }, [from])

  const [modalOpen, setModalOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [prefillDate, setPrefillDate] = useState<string | null>(null)
  const [prefillPropertyId, setPrefillPropertyId] = useState<string | null>(null)

  const { data: properties = [] } = useProperties(user?.id)
  const { data: bookings = [], isLoading } = useBookings(user?.id, from, to)

  useEffect(() => {
    isLoadingMoreRef.current = false

    const container = scrollContainerRef.current
    if (!container) return

    const totalDays = differenceInCalendarDays(parseISO(to), parseISO(from)) + 1
    if (totalDays <= MAX_WINDOW_MONTHS * 31) return

    const anchorIndex = Math.floor(container.scrollLeft / COL_WIDTH)
    const totalDaysInWindow = differenceInCalendarDays(parseISO(to), parseISO(from))
    const safeIndex = Math.min(Math.max(anchorIndex, 0), totalDaysInWindow)
    const windowStart = parseISO(from)
    const anchorDateStr = format(
      new Date(windowStart.getTime() + safeIndex * 24 * 60 * 60 * 1000),
      'yyyy-MM-dd'
    )

    const trimmedFrom = format(subMonths(startOfMonth(parseISO(anchorDateStr)), 6), 'yyyy-MM-dd')
    const trimmedTo = format(endOfMonth(addMonths(parseISO(anchorDateStr), 6)), 'yyyy-MM-dd')

    if (trimmedFrom > from) setFrom(trimmedFrom)
    if (trimmedTo < to) setTo(trimmedTo)
  }, [bookings]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleCellClick(date: string, propertyId: string) {
    setPrefillDate(date)
    setPrefillPropertyId(propertyId)
    setSelectedBooking(null)
    setModalOpen(true)
  }

  function handleBookingClick(booking: Booking) {
    setSelectedBooking(booking)
    setPrefillDate(null)
    setPrefillPropertyId(null)
    setModalOpen(true)
  }

  return (
    <div className="flex flex-col h-full">
      <SummaryBar bookings={bookings} properties={properties} from={from} to={to} />

      {/* Date range picker */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-b border-gray-200 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <label className="text-xs text-gray-400 flex-shrink-0">С</label>
          <input
            type="date"
            value={from}
            max={to}
            onChange={e => setFrom(e.target.value)}
            className="flex-1 min-w-0 text-sm text-gray-800 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#376E6F]/30 focus:border-[#376E6F]"
          />
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <label className="text-xs text-gray-400 flex-shrink-0">По</label>
          <input
            type="date"
            value={to}
            min={from}
            onChange={e => setTo(e.target.value)}
            className="flex-1 min-w-0 text-sm text-gray-800 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#376E6F]/30 focus:border-[#376E6F]"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center flex-1">
          <div className="w-8 h-8 border-4 border-[#376E6F] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : isMobile ? (
        <MobileChessGrid
          properties={properties}
          bookings={bookings}
          currentMonth={currentMonth}
          from={from}
          to={to}
          onCellClick={handleCellClick}
          onBookingClick={handleBookingClick}
        />
      ) : (
        <ChessGrid
          properties={properties}
          bookings={bookings}
          currentMonth={currentMonth}
          from={from}
          to={to}
          onCellClick={handleCellClick}
          onBookingClick={handleBookingClick}
        />
      )}

      {modalOpen && (
        <BookingModal
          booking={selectedBooking}
          properties={properties}
          prefillDate={prefillDate}
          prefillPropertyId={prefillPropertyId}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  )
}
