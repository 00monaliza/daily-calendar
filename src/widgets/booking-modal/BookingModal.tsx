import { useEffect, useRef, useState, type FormEvent } from 'react'
import { differenceInDays, format, addDays } from 'date-fns'
import { useUser } from '@/features/auth/useUser'
import { useCreateBooking, useUpdateBooking, useDeleteBooking } from '@/entities/booking/queries'
import type { Booking, PaymentStatus, BookingSource } from '@/entities/booking/types'
import { useSettings, useUpdateSettings } from '@/entities/settings/queries'

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

const DEFAULT_SOURCES: BookingSource[] = ['direct', 'kaspi', 'booking', 'airbnb', 'avito', 'cash', 'other']
const SOURCE_LABELS: Record<string, string> = {
  direct: 'Напрямую',
  kaspi: 'Kaspi',
  booking: 'Booking.com',
  airbnb: 'Airbnb',
  avito: 'Avito',
  cash: 'Наличные',
  other: 'Другое',
}

function getSourceLabel(value: string) {
  return SOURCE_LABELS[value] ?? value
}

function normalizeSourceValue(value: string) {
  return value.trim()
}

function extractPhoneDigits(value: string) {
  return value.replace(/\D/g, '')
}

function formatPhoneForDialing(value: string) {
  const digits = extractPhoneDigits(value)
  return digits ? `+${digits}` : ''
}

function formatMoney(value: number) {
  return value > 0 ? `${value.toLocaleString('ru-RU')} ₸` : ''
}

function CallIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M2.75 4.5c0-.966.784-1.75 1.75-1.75h2.1c.68 0 1.287.417 1.532 1.053l.93 2.413a1.75 1.75 0 0 1-.48 1.92l-1.226 1.044a9.78 9.78 0 0 0 4.664 4.664l1.044-1.226a1.75 1.75 0 0 1 1.92-.48l2.413.93c.636.245 1.053.851 1.053 1.532v2.1c0 .966-.784 1.75-1.75 1.75h-.75C9.8 19 2 11.2 2 5.25v-.75Z" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4" aria-hidden="true">
      <rect x="6" y="6" width="9" height="9" rx="2" />
      <path d="M5 13H4.5A1.5 1.5 0 0 1 3 11.5v-7A1.5 1.5 0 0 1 4.5 3h7A1.5 1.5 0 0 1 13 4.5V5" />
    </svg>
  )
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M12 2.2a9.8 9.8 0 0 0-8.47 14.76L2 22l5.18-1.51A9.8 9.8 0 1 0 12 2.2Zm0 17.84c-1.33 0-2.63-.35-3.79-1.03l-.27-.16-3.06.89.91-2.98-.17-.28a7.8 7.8 0 1 1 6.38 3.56Zm4.54-5.88c-.25-.12-1.46-.72-1.69-.8-.23-.08-.4-.12-.57.12-.17.25-.66.8-.8.97-.15.17-.29.18-.54.06-.25-.12-1.05-.39-2-1.24-.74-.66-1.24-1.48-1.39-1.73-.14-.25-.01-.39.11-.52.11-.11.25-.29.37-.44.12-.15.16-.25.25-.41.08-.16.04-.29-.02-.41-.06-.12-.56-1.35-.77-1.85-.2-.48-.4-.42-.56-.43h-.48c-.16 0-.41.06-.63.29-.22.24-.84.82-.84 2s.86 2.31.98 2.47c.12.17 1.68 2.57 4.08 3.6.57.24 1.02.39 1.37.5.57.18 1.1.15 1.51.09.46-.07 1.46-.6 1.67-1.17.21-.58.21-1.08.15-1.18-.06-.1-.22-.17-.47-.29Z" />
    </svg>
  )
}

export function BookingModal({ booking, properties, prefillDate, prefillPropertyId, onClose }: Props) {
  const isMobile = useIsMobile()
  const { user } = useUser()
  const { data: settings } = useSettings()
  const updateSettings = useUpdateSettings()
  const createBooking = useCreateBooking()
  const updateBooking = useUpdateBooking()
  const deleteBooking = useDeleteBooking()

  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')
  const defaultCheckIn = prefillDate ?? format(new Date(), 'yyyy-MM-dd')
  const defaultCheckOut = prefillDate ? format(addDays(new Date(prefillDate), 1), 'yyyy-MM-dd') : tomorrow
  const defaultProperty = prefillPropertyId ?? properties[0]?.id ?? ''
  const initialNights = differenceInDays(new Date(booking?.check_out ?? defaultCheckOut), new Date(booking?.check_in ?? defaultCheckIn))
  const defaultPropertyBasePrice = properties.find(p => p.id === (booking?.property_id ?? defaultProperty))?.base_price ?? 0

  const [propertyId, setPropertyId] = useState(booking?.property_id ?? defaultProperty)
  const [checkIn, setCheckIn] = useState(booking?.check_in ?? defaultCheckIn)
  const [checkInTime, setCheckInTime] = useState(booking?.check_in_time ?? '14:00')
  const [checkOut, setCheckOut] = useState(booking?.check_out ?? defaultCheckOut)
  const [checkOutTime, setCheckOutTime] = useState(booking?.check_out_time ?? '12:00')
  const [guestName, setGuestName] = useState(booking?.guest_name ?? '')
  const [guestPhone, setGuestPhone] = useState(booking?.guest_phone ?? '')
  const [totalPrice, setTotalPrice] = useState(booking?.total_price ?? 0)
  const [prepayment, setPrepayment] = useState(booking?.prepayment ?? 0)
  const [nightlyPrice, setNightlyPrice] = useState(
    booking
      ? (initialNights > 0 ? booking.total_price / initialNights : 0)
      : defaultPropertyBasePrice,
  )
  const [remainingAmount, setRemainingAmount] = useState(Math.max(0, (booking?.total_price ?? 0) - (booking?.prepayment ?? 0)))
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(booking?.payment_status ?? 'waiting')
  const [source, setSource] = useState<BookingSource>(booking?.source ?? DEFAULT_SOURCES[0])
  const [sourcesDraft, setSourcesDraft] = useState<BookingSource[] | null>(null)
  const [newSource, setNewSource] = useState('')
  const [comment, setComment] = useState(booking?.comment ?? '')
  const [bookingColor, setBookingColor] = useState(booking?.color ?? BOOKING_COLORS[0])
  const [phoneCopyState, setPhoneCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const phoneCopyTimeoutRef = useRef<number | null>(null)

  const nights = differenceInDays(new Date(checkOut), new Date(checkIn))
  const savedSources = Array.from(
    new Set(
      (settings?.booking_sources ?? [])
        .map(normalizeSourceValue)
        .filter(Boolean),
    ),
  )
  const sources = sourcesDraft ?? (savedSources.length > 0 ? savedSources : DEFAULT_SOURCES)
  const currentSource = sources.includes(source) ? source : (sources[0] ?? DEFAULT_SOURCES[0])
  const guestPhoneDigits = extractPhoneDigits(guestPhone)
  const guestPhoneDial = formatPhoneForDialing(guestPhone)
  const guestPhoneWhatsApp = guestPhoneDigits.length >= 10 ? `https://wa.me/${guestPhoneDigits}` : ''

  useEffect(() => {
    return () => {
      if (phoneCopyTimeoutRef.current) {
        window.clearTimeout(phoneCopyTimeoutRef.current)
      }
    }
  }, [])

  function sanitizeMoney(value: string) {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return 0
    return Math.max(0, parsed)
  }

  function recalcByNightly(nextNightly: number, nextNights: number, nextPrepayment: number) {
    const computedTotal = nextNights > 0 ? nextNightly * nextNights : 0
    setTotalPrice(computedTotal)
    setRemainingAmount(Math.max(0, computedTotal - nextPrepayment))
  }

  function handlePropertyChange(nextPropertyId: string) {
    setPropertyId(nextPropertyId)
    const property = properties.find(p => p.id === nextPropertyId)
    if (!property) return
    const nextNightly = property.base_price
    setNightlyPrice(nextNightly)
    recalcByNightly(nextNightly, nights, prepayment)
  }

  function handleCheckInChange(nextCheckIn: string) {
    setCheckIn(nextCheckIn)
    const nextNights = differenceInDays(new Date(checkOut), new Date(nextCheckIn))
    recalcByNightly(nightlyPrice, nextNights, prepayment)
  }

  function handleCheckOutChange(nextCheckOut: string) {
    setCheckOut(nextCheckOut)
    const nextNights = differenceInDays(new Date(nextCheckOut), new Date(checkIn))
    recalcByNightly(nightlyPrice, nextNights, prepayment)
  }

  function handleNightlyPriceChange(rawValue: string) {
    const nextNightly = sanitizeMoney(rawValue)
    setNightlyPrice(nextNightly)
    recalcByNightly(nextNightly, nights, prepayment)
  }

  function handleTotalPriceChange(rawValue: string) {
    const nextTotal = sanitizeMoney(rawValue)
    setTotalPrice(nextTotal)

    const nextNightly = nights > 0 ? nextTotal / nights : 0
    setNightlyPrice(nextNightly)

    setRemainingAmount(Math.max(0, nextTotal - prepayment))
  }

  function handlePrepaymentChange(rawValue: string) {
    const nextPrepayment = sanitizeMoney(rawValue)
    setPrepayment(nextPrepayment)
    setRemainingAmount(Math.max(0, totalPrice - nextPrepayment))
  }

  function handleRemainingAmountChange(rawValue: string) {
    const nextRemaining = sanitizeMoney(rawValue)
    setRemainingAmount(nextRemaining)
    setPrepayment(Math.max(0, totalPrice - nextRemaining))
  }

  function schedulePhoneCopyReset() {
    if (phoneCopyTimeoutRef.current) {
      window.clearTimeout(phoneCopyTimeoutRef.current)
    }

    phoneCopyTimeoutRef.current = window.setTimeout(() => {
      setPhoneCopyState('idle')
    }, 1600)
  }

  async function handleCopyPhone() {
    if (!guestPhoneDial) return

    const phoneToCopy = guestPhone.trim() || guestPhoneDial

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(phoneToCopy)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = phoneToCopy
        textarea.setAttribute('readonly', 'true')
        textarea.style.position = 'absolute'
        textarea.style.left = '-9999px'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }

      setPhoneCopyState('copied')
    } catch {
      setPhoneCopyState('error')
    } finally {
      schedulePhoneCopyReset()
    }
  }

  async function persistSources(nextSources: BookingSource[]) {
    setSourcesDraft(nextSources)
    try {
      await updateSettings.mutateAsync({ booking_sources: nextSources })
    } finally {
      setSourcesDraft(null)
    }
  }

  function handleAddSource() {
    const value = normalizeSourceValue(newSource)
    if (!value) return

    if (sources.includes(value)) {
      setSource(value)
      setNewSource('')
      return
    }

    const next = [...sources, value]
    setSource(value)
    setNewSource('')
    void persistSources(next)
  }

  function handleRemoveSource(valueToRemove: BookingSource) {
    const next = sources.filter(s => s !== valueToRemove)
    if (next.length === 0) return

    setSource(prev => (prev === valueToRemove ? next[0] : prev))
    void persistSources(next)
  }

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
      source: currentSource,
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
          onChange={e => handlePropertyChange(e.target.value)}
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
              onChange={e => handleCheckInChange(e.target.value)}
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
              onChange={e => handleCheckOutChange(e.target.value)}
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
        {guestPhoneDial && (
          <div className="mt-2 flex flex-wrap gap-2">
            <a
              href={`tel:${guestPhoneDial}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <CallIcon />
              Позвонить
            </a>
            <button
              type="button"
              onClick={handleCopyPhone}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <CopyIcon />
              {phoneCopyState === 'copied' ? 'Скопировано' : phoneCopyState === 'error' ? 'Не удалось' : 'Копировать номер'}
            </button>
            {guestPhoneWhatsApp && (
              <a
                href={guestPhoneWhatsApp}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#25D366]/30 bg-[#25D366]/10 px-3 py-2 text-xs font-medium text-[#128C7E] hover:bg-[#25D366]/15"
                title="Откроется чат WhatsApp, если номер доступен в сервисе"
              >
                <WhatsAppIcon />
                WhatsApp
              </a>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Цена квартиры за ночь (₸)</label>
          <input
            type="number"
            min={0}
            value={nightlyPrice}
            onChange={e => handleNightlyPriceChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#376E6F]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Сумма за период (₸)</label>
          <input
            type="number"
            min={0}
            value={totalPrice}
            onChange={e => handleTotalPriceChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#376E6F]"
          />
          {totalPrice > 0 && (
            <div className="mt-1 text-xs text-gray-500">
              Итого: {formatMoney(totalPrice)}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Внесено (₸)</label>
          <input
            type="number"
            min={0}
            value={prepayment}
            onChange={e => handlePrepaymentChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#376E6F]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Остаток к оплате (₸)</label>
          <input
            type="number"
            min={0}
            value={remainingAmount}
            onChange={e => handleRemainingAmountChange(e.target.value)}
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
          value={currentSource}
          onChange={e => setSource(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#376E6F]"
        >
          {sources.map(s => (
            <option key={s} value={s}>{getSourceLabel(s)}</option>
          ))}
        </select>
        <div className="mt-2 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={newSource}
              onChange={e => setNewSource(e.target.value)}
              placeholder="Новый источник"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#376E6F]"
            />
            <button
              type="button"
              onClick={handleAddSource}
              className="px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Добавить
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {sources.map(s => (
              <div
                key={s}
                className={`inline-flex items-center rounded-full border px-2 py-1 text-xs ${currentSource === s ? 'border-[#376E6F] text-[#376E6F] bg-[#376E6F]/10' : 'border-gray-200 text-gray-600'}`}
              >
                <button
                  type="button"
                  onClick={() => setSource(s)}
                  className="pr-1"
                >
                  {getSourceLabel(s)}
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveSource(s)}
                  disabled={sources.length <= 1}
                  className="pl-1 text-gray-400 hover:text-red-500 disabled:opacity-40"
                  aria-label={`Удалить источник ${getSourceLabel(s)}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
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
