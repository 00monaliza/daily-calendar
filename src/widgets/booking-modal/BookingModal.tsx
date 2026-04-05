import { useState, type FormEvent, useEffect } from 'react'
import { differenceInDays, format, addDays } from 'date-fns'
import { useUser } from '@/features/auth/useUser'
import { useCreateBooking, useUpdateBooking, useDeleteBooking } from '@/entities/booking/queries'
import type { Booking, PaymentStatus, BookingSource } from '@/entities/booking/types'

const BOOKING_COLORS = ['#5e81ea', '#F5A623', '#E05C5C', '#7EC8E3', '#C3A6E8', '#7BC67E']
import type { Property } from '@/entities/property/types'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import { BottomSheet } from '@/widgets/bottom-sheet/BottomSheet'

interface Props {
  booking: Booking | null
  properties: Property[]
  prefillDate: string | null
  prefillPropertyId: string | null
  onClose: () => void
}

const SOURCES: { value: BookingSource; label: string }[] = [
  { value: 'direct', label: 'Напрямую' },
  { value: 'kaspi', label: 'Kaspi' },
  { value: 'booking', label: 'Booking.com' },
  { value: 'airbnb', label: 'Airbnb' },
  { value: 'avito', label: 'Avito' },
  { value: 'other', label: 'Другое' },
]

export function BookingModal({ booking, properties, prefillDate, prefillPropertyId, onClose }: Props) {
  const isMobile = useIsMobile()
  const { user } = useUser()
  const createBooking = useCreateBooking()
  const updateBooking = useUpdateBooking()
  const deleteBooking = useDeleteBooking()

  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')
  const defaultCheckIn = prefillDate ?? format(new Date(), 'yyyy-MM-dd')
  const defaultCheckOut = prefillDate ? format(addDays(new Date(prefillDate), 1), 'yyyy-MM-dd') : tomorrow
  const defaultProperty = prefillPropertyId ?? properties[0]?.id ?? ''

  const [propertyId, setPropertyId] = useState(booking?.property_id ?? defaultProperty)
  const [checkIn, setCheckIn] = useState(booking?.check_in ?? defaultCheckIn)
  const [checkInTime, setCheckInTime] = useState(booking?.check_in_time ?? '14:00')
  const [checkOut, setCheckOut] = useState(booking?.check_out ?? defaultCheckOut)
  const [checkOutTime, setCheckOutTime] = useState(booking?.check_out_time ?? '12:00')
  const [guestName, setGuestName] = useState(booking?.guest_name ?? '')
  const [guestPhone, setGuestPhone] = useState(booking?.guest_phone ?? '')
  const [totalPrice, setTotalPrice] = useState(booking?.total_price ?? 0)
  const [prepayment, setPrepayment] = useState(booking?.prepayment ?? 0)
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(booking?.payment_status ?? 'waiting')
  const [source, setSource] = useState<BookingSource>(booking?.source ?? 'direct')
  const [comment, setComment] = useState(booking?.comment ?? '')
  const [bookingColor, setBookingColor] = useState(booking?.color ?? BOOKING_COLORS[0])

  const selectedProperty = properties.find(p => p.id === propertyId)
  const nights = differenceInDays(new Date(checkOut), new Date(checkIn))

  useEffect(() => {
    if (!booking && selectedProperty && nights > 0) {
      setTotalPrice(selectedProperty.base_price * nights)
    }
  }, [propertyId, checkIn, checkOut, selectedProperty, nights, booking])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return

    const data = {
      owner_id: user.id,
      property_id: propertyId,
      guest_name: guestName,
      guest_phone: guestPhone || null,
      check_in: checkIn,
      check_out: checkOut,
      check_in_time: checkInTime || null,
      check_out_time: checkOutTime || null,
      total_price: totalPrice,
      prepayment,
      payment_status: paymentStatus,
      source,
      comment: comment || null,
      color: bookingColor,
    }

    if (booking) {
      await updateBooking.mutateAsync({ id: booking.id, data })
    } else {
      await createBooking.mutateAsync(data)
    }
    onClose()
  }

  async function handleDelete() {
    if (!booking || !confirm('Удалить бронь?')) return
    await deleteBooking.mutateAsync(booking.id)
    onClose()
  }

  const isLoading = createBooking.isPending || updateBooking.isPending || deleteBooking.isPending

  const formContent = (
    <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Квартира *</label>
        <select
          required
          value={propertyId}
          onChange={e => setPropertyId(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#376E6F]"
        >
          {properties.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Заезд *</label>
          <div className="flex gap-1.5">
            <input
              type="date"
              required
              value={checkIn}
              onChange={e => setCheckIn(e.target.value)}
              className="flex-1 min-w-0 border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#376E6F]"
            />
            <input
              type="time"
              value={checkInTime}
              onChange={e => setCheckInTime(e.target.value)}
              className="w-20 border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#376E6F]"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Выезд *</label>
          <div className="flex gap-1.5">
            <input
              type="date"
              required
              value={checkOut}
              min={checkIn}
              onChange={e => setCheckOut(e.target.value)}
              className="flex-1 min-w-0 border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#376E6F]"
            />
            <input
              type="time"
              value={checkOutTime}
              onChange={e => setCheckOutTime(e.target.value)}
              className="w-20 border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#376E6F]"
            />
          </div>
        </div>
      </div>

      {nights > 0 && (
        <div className="text-xs text-gray-500">{nights} {nights === 1 ? 'ночь' : nights < 5 ? 'ночи' : 'ночей'}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Имя гостя *</label>
        <input
          type="text"
          required
          value={guestName}
          onChange={e => setGuestName(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#376E6F]"
          placeholder="Иванов Иван"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Телефон</label>
        <input
          type="tel"
          value={guestPhone}
          onChange={e => setGuestPhone(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#376E6F]"
          placeholder="+7 777 000 00 00"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Сумма (₸)</label>
          <input
            type="number"
            min={0}
            value={totalPrice}
            onChange={e => setTotalPrice(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#376E6F]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Предоплата (₸)</label>
          <input
            type="number"
            min={0}
            value={prepayment}
            onChange={e => setPrepayment(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#376E6F]"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Статус оплаты</label>
        <div className="flex rounded-lg overflow-hidden border border-gray-200">
          {([['waiting', 'Ожидает'], ['partial', 'Частично'], ['paid', 'Оплачено']] as const).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setPaymentStatus(val)}
              className={`flex-1 py-1.5 text-xs font-medium transition-colors ${paymentStatus === val ? 'bg-[#376E6F] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Источник</label>
        <select
          value={source}
          onChange={e => setSource(e.target.value as BookingSource)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#376E6F]"
        >
          {SOURCES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Комментарий</label>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#376E6F] resize-none"
          placeholder="Дополнительная информация..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Цвет брони</label>
        <div className="flex gap-2.5">
          {BOOKING_COLORS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setBookingColor(c)}
              className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${bookingColor === c ? 'ring-2 ring-offset-2 ring-gray-500 scale-110' : ''}`}
              style={{ backgroundColor: c }}
              aria-label={c}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        {booking && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            Удалить
          </button>
        )}
        <button
          type="submit"
          disabled={isLoading || nights <= 0}
          className="flex-1 bg-[#376E6F] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#1C3334] transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </form>
  )

  if (isMobile) {
    return (
      <BottomSheet
        open
        onClose={onClose}
        title={booking ? 'Редактировать бронь' : 'Новая бронь'}
      >
        {formContent}
      </BottomSheet>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">
            {booking ? 'Редактировать бронь' : 'Новая бронь'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        {formContent}
      </div>
    </div>
  )
}
