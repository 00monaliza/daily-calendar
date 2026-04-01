import { useState } from 'react'
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns'
import { ru } from 'date-fns/locale'
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
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [prefillDate, setPrefillDate] = useState<string | null>(null)
  const [prefillPropertyId, setPrefillPropertyId] = useState<string | null>(null)

  const from = format(startOfMonth(currentMonth), 'yyyy-MM-dd')
  const to = format(endOfMonth(currentMonth), 'yyyy-MM-dd')

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

  return (
    <div className="flex flex-col h-full">
      <SummaryBar bookings={bookings} properties={properties} from={from} to={to} />

      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
        <button
          onClick={() => setCurrentMonth(m => subMonths(m, 1))}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
        >
          ‹
        </button>
        <span className="font-semibold text-gray-800 min-w-[160px] text-center">
          {format(currentMonth, 'LLLL yyyy', { locale: ru })}
        </span>
        <button
          onClick={() => setCurrentMonth(m => addMonths(m, 1))}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
        >
          ›
        </button>
        <button
          onClick={() => setCurrentMonth(new Date())}
          className="ml-2 text-xs text-[#376E6F] hover:underline"
        >
          Сегодня
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
          onCellClick={handleCellClick}
          onBookingClick={handleBookingClick}
        />
      ) : (
        <ChessGrid
          properties={properties}
          bookings={bookings}
          currentMonth={currentMonth}
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
