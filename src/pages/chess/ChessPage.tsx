import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  format,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  parseISO,
  differenceInCalendarDays,
  addDays,
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
  const [monthInputValue, setMonthInputValue] = useState(() => format(new Date(), 'yyyy-MM'))

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const isLoadingMoreRef = useRef(false)
  const prevFromRef = useRef(from)
  const isTeleportRef = useRef(false)
  const teleportTargetRef = useRef<string | null>(null)
  const isInitializedRef = useRef(false)

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

  function teleportToMonth(yearMonth: string) {
    if (!yearMonth) return
    setMonthInputValue(yearMonth)
    const [year, month] = yearMonth.split('-').map(Number)
    if (isNaN(year) || isNaN(month)) return
    const target = new Date(year, month - 1, 1)
    const newFrom = format(subMonths(startOfMonth(target), 2), 'yyyy-MM-dd')
    const newTo = format(endOfMonth(addMonths(target, 2)), 'yyyy-MM-dd')
    isTeleportRef.current = true
    teleportTargetRef.current = format(target, 'yyyy-MM-dd')
    setFrom(newFrom)
    setTo(newTo)
  }

  function scrollToToday() {
    const now = new Date()
    const todayStr = format(now, 'yyyy-MM-dd')
    const container = scrollContainerRef.current

    if (todayStr >= from && todayStr <= to && container) {
      const todayOffset = differenceInCalendarDays(parseISO(todayStr), parseISO(from))
      container.scrollLeft = Math.max(0, todayOffset * COL_WIDTH)
    } else {
      isTeleportRef.current = true
      teleportTargetRef.current = todayStr
      const w = initialWindow()
      setFrom(w.from)
      setTo(w.to)
    }
  }

  useLayoutEffect(() => {
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

  useEffect(() => {
    const target = teleportTargetRef.current
    const container = scrollContainerRef.current
    if (!target || !container) return
    const dayOffset = differenceInCalendarDays(parseISO(target), parseISO(from))
    const halfVisible = Math.floor((container.clientWidth - 160) / 2)
    container.scrollLeft = Math.max(0, dayOffset * COL_WIDTH - halfVisible)
    teleportTargetRef.current = null
    isTeleportRef.current = false
  }, [from, to])

  const [modalOpen, setModalOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [prefillDate, setPrefillDate] = useState<string | null>(null)
  const [prefillPropertyId, setPrefillPropertyId] = useState<string | null>(null)

  const navigate = useNavigate()

  const { data: properties = [] } = useProperties(user?.id)
  const { data: bookings = [], isLoading, isSuccess, refetch, isRefetching } = useBookings(user?.id, from, to)

  // Scroll to today after first successful data load
  useEffect(() => {
    if (!isSuccess || isInitializedRef.current) return
    const container = scrollContainerRef.current
    if (!container) return
    isInitializedRef.current = true
    if (!isTeleportRef.current) {
      const todayOffset = differenceInCalendarDays(new Date(), parseISO(from))
      const halfVisible = Math.floor((container.clientWidth - 160) / 2)
      container.scrollLeft = Math.max(0, todayOffset * COL_WIDTH - halfVisible)
    }
  }, [isSuccess]) // eslint-disable-line react-hooks/exhaustive-deps

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
      addDays(windowStart, safeIndex),
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

      {/* Teleport date picker */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-b border-gray-200">
        <label htmlFor="chess-teleport-month" className="text-xs text-gray-400 flex-shrink-0">Перейти к</label>
        <input
          id="chess-teleport-month"
          type="month"
          value={monthInputValue}
          onChange={e => teleportToMonth(e.target.value)}
          className="flex-1 min-w-0 text-sm text-gray-800 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#376E6F]/30 focus:border-[#376E6F]"
        />
      </div>

      {/* Toolbar: Сегодня + refresh слева, Добавить квартиру справа */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2">
          <button
            onClick={scrollToToday}
            className="text-xs font-medium text-[#376E6F] border border-[#376E6F]/40 rounded-lg px-2.5 py-1 hover:bg-[#376E6F]/10 transition-colors"
          >
            Сегодня
          </button>
          <button
            onClick={() => refetch()}
            disabled={isRefetching || isLoading}
            title="Обновить"
            className="text-[#376E6F] border border-[#376E6F]/40 rounded-lg p-1 hover:bg-[#376E6F]/10 transition-colors disabled:opacity-50"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`}
            >
              <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        <button
          onClick={() => navigate('/properties')}
          className="text-xs font-medium text-[#376E6F] border border-[#376E6F]/40 rounded-lg px-2.5 py-1 hover:bg-[#376E6F]/10 transition-colors"
        >
          + Добавить квартиру
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center flex-1">
          <div className="w-8 h-8 border-4 border-[#376E6F] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : isMobile ? (
        <MobileChessGrid
          properties={properties}
          bookings={bookings}
          from={from}
          to={to}
          onCellClick={handleCellClick}
          onBookingClick={handleBookingClick}
          onLoadPrev={extendPrev}
          onLoadNext={extendNext}
          scrollContainerRef={scrollContainerRef}
        />
      ) : (
        <ChessGrid
          properties={properties}
          bookings={bookings}
          from={from}
          to={to}
          onCellClick={handleCellClick}
          onBookingClick={handleBookingClick}
          onLoadPrev={extendPrev}
          onLoadNext={extendNext}
          scrollContainerRef={scrollContainerRef}
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
