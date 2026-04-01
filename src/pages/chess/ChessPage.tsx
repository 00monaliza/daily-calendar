import { useState } from 'react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { useUser } from '@/features/auth/useUser'
import { useProperties } from '@/entities/property/queries'
import { useBookings } from '@/entities/booking/queries'
import { SummaryBar } from '@/widgets/summary-bar/SummaryBar'
import { ChessGrid } from '@/widgets/chess-grid/ChessGrid'
import { BookingModal } from '@/widgets/booking-modal/BookingModal'
import type { Booking } from '@/entities/booking/types'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import { MobileChessGrid } from '@/widgets/chess-grid/MobileChessGrid'

export function ChessPage() {
  const isMobile = useIsMobile()
  const { user } = useUser()

  const [from, setFrom] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [to, setTo] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'))

  const [modalOpen, setModalOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [prefillDate, setPrefillDate] = useState<string | null>(null)
  const [prefillPropertyId, setPrefillPropertyId] = useState<string | null>(null)

  const { data: properties = [] } = useProperties(user?.id)
  const { data: bookings = [], isLoading } = useBookings(user?.id, from, to)

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

  function handleFromChange(value: string) {
    setFrom(value)
    if (value > to) setTo(value)
  }

  function handleToChange(value: string) {
    setTo(value)
    if (value < from) setFrom(value)
  }

  function resetToCurrentMonth() {
    setFrom(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
    setTo(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  }

  const currentMonth = new Date(from)

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
            onChange={e => handleFromChange(e.target.value)}
            className="flex-1 min-w-0 text-sm text-gray-800 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#376E6F]/30 focus:border-[#376E6F]"
          />
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <label className="text-xs text-gray-400 flex-shrink-0">По</label>
          <input
            type="date"
            value={to}
            min={from}
            onChange={e => handleToChange(e.target.value)}
            className="flex-1 min-w-0 text-sm text-gray-800 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#376E6F]/30 focus:border-[#376E6F]"
          />
        </div>
        <button
          onClick={resetToCurrentMonth}
          className="text-xs text-[#376E6F] hover:underline flex-shrink-0 py-1.5 px-1"
        >
          Текущий месяц
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
