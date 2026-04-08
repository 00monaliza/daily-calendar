import React, { useRef, useEffect } from 'react'
import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  isSameDay,
  isToday,
  parseISO,
  subDays,
} from 'date-fns'
import { ru } from 'date-fns/locale'
import type { Property } from '@/entities/property/types'
import type { Booking, BookingWithProperty } from '@/entities/booking/types'
import { useSettings } from '@/entities/settings/queries'
import { getPropertyColor } from '@/shared/lib/propertyColors'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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
  onReorder?: (ids: string[]) => void
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 55, g: 110, b: 111 }
}

function contrastTextColor(r: number, g: number, b: number): string {
  const luminance = 0.2126 * (r / 255) ** 2.2 + 0.7152 * (g / 255) ** 2.2 + 0.0722 * (b / 255) ** 2.2
  return luminance > 0.35 ? '#1a1a1a' : '#ffffff'
}

const MOBILE_COL_WIDTH = 36

function isDayWeekend(day: Date) {
  const d = day.getDay()
  return d === 0 || d === 6
}

function getBookingVisualEndDate(booking: Pick<Booking, 'check_in' | 'check_out'>): Date {
  const checkIn = parseISO(booking.check_in)
  const checkOut = parseISO(booking.check_out)

  if (checkOut <= checkIn) return checkIn
  return subDays(checkOut, 1)
}

function getVisibleSpanDays(startDay: Date, checkoutDay: Date, rangeEndInclusive: Date): number {
  const rangeEndExclusive = addDays(rangeEndInclusive, 1)
  const effectiveEndExclusive = checkoutDay < rangeEndExclusive ? checkoutDay : rangeEndExclusive
  return Math.max(1, differenceInCalendarDays(effectiveEndExclusive, startDay))
}

function GripIcon() {
  return (
    <svg
      width="8"
      height="12"
      viewBox="0 0 10 14"
      fill="currentColor"
      className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0"
    >
      <circle cx="2" cy="2" r="1.5" />
      <circle cx="8" cy="2" r="1.5" />
      <circle cx="2" cy="7" r="1.5" />
      <circle cx="8" cy="7" r="1.5" />
      <circle cx="2" cy="12" r="1.5" />
      <circle cx="8" cy="12" r="1.5" />
    </svg>
  )
}

interface SortableMobileRowProps {
  property: Property
  days: Date[]
  propBookings: Map<string, Booking>
  rowHeight: number
  showFullText: boolean
  to: string
  onCellClick: (date: string, propertyId: string) => void
  onBookingClick: (booking: Booking) => void
}

function SortableMobileRow({
  property,
  days,
  propBookings,
  rowHeight,
  showFullText,
  to,
  onCellClick,
  onBookingClick,
}: SortableMobileRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: property.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
    zIndex: isDragging ? 1 : 'auto',
  }

  return (
    <tr ref={setNodeRef} style={style}>
      <td style={{ width: 1, minWidth: 1, padding: 0, border: 'none' }} aria-hidden="true" />
      <td
        className="sticky left-0 z-20 bg-white border-b border-r border-gray-200 px-2 py-0"
        style={{ minWidth: 100 }}
      >
        <div className="flex items-center gap-1.5 py-1">
          <span
            {...attributes}
            {...listeners}
            className="flex-shrink-0"
            style={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
            title="Перетащить"
          >
            <GripIcon />
          </span>
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: getPropertyColor(property) }}
          />
          <span className="text-xs font-medium text-gray-800 truncate" style={{ maxWidth: 66 }}>
            {property.name}
          </span>
        </div>
      </td>
      {days.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd')
        const booking = propBookings.get(dateStr)
        const today = isToday(day)
        const weekend = isDayWeekend(day)

        if (booking) {
          const isStart = isSameDay(parseISO(booking.check_in), day)
          const isEnd = isSameDay(getBookingVisualEndDate(booking), day)
          const cardColor = booking.color ?? getPropertyColor(property)
          const cardRgb = hexToRgb(cardColor)

          let textOverlay: React.ReactNode = null
          if (isStart) {
            const checkOut = parseISO(booking.check_out)
            const rangeEnd = parseISO(to)
            const spanDays = getVisibleSpanDays(day, checkOut, rangeEnd)
            const textWidth = spanDays * MOBILE_COL_WIDTH - 6
            const isCompactLabel = spanDays <= 2 || textWidth < 84
            const labelText =
              showFullText && !isCompactLabel && booking.comment
                ? `${booking.guest_name} — ${booking.comment}`
                : booking.guest_name

            textOverlay = (
              <div
                className="absolute top-0.5 bottom-0.5 left-[5px] z-10 flex flex-col items-center justify-center pointer-events-none overflow-hidden"
                style={{ width: `${textWidth}px` }}
              >
                <span
                  className={
                    isCompactLabel
                      ? 'text-[9px] font-semibold leading-tight truncate w-full text-center'
                      : showFullText
                        ? 'text-[9px] font-medium whitespace-normal break-words leading-tight w-full text-center'
                        : 'text-[9px] font-medium truncate w-full text-center'
                  }
                  style={{ color: contrastTextColor(cardRgb.r, cardRgb.g, cardRgb.b) }}
                >
                  {labelText}
                </span>
              </div>
            )
          }

          return (
            <td
              key={dateStr}
              className={`border-b border-gray-100 p-0 cursor-pointer relative ${
                today ? 'border-l-2 border-l-[#376E6F]' : ''
              } ${weekend && !today ? 'bg-gray-50' : ''}`}
              style={{ height: rowHeight }}
              onClick={() => onBookingClick(booking)}
            >
              <div
                className="absolute inset-y-0.5"
                style={{
                  left: isStart ? '2px' : '0',
                  right: isEnd ? '2px' : '0',
                  backgroundColor: `rgba(${cardRgb.r},${cardRgb.g},${cardRgb.b},0.85)`,
                  borderLeft: isStart ? `3px solid ${cardColor}` : 'none',
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
            className={`border border-gray-200 cursor-pointer active:bg-[#376E6F]/20 transition-colors ${
              today
                ? 'border-l-2 border-l-[#376E6F] bg-[#376E6F]/5'
                : weekend
                ? 'bg-gray-50'
                : ''
            }`}
            style={{ height: rowHeight }}
            onClick={() => onCellClick(dateStr, property.id)}
          />
        )
      })}
      <td style={{ width: 1, minWidth: 1, padding: 0, border: 'none' }} aria-hidden="true" />
    </tr>
  )
}

export function MobileChessGrid({
  properties,
  bookings,
  from,
  to,
  onCellClick,
  onBookingClick,
  onLoadPrev,
  onLoadNext,
  scrollContainerRef,
  onReorder,
}: Props) {
  const { data: settings } = useSettings()
  const showFullText = settings?.show_full_text ?? true
  const rowHeight = settings?.compact_mode ? 32 : 44

  const leftSentinelRef = useRef<HTMLTableCellElement>(null)
  const rightSentinelRef = useRef<HTMLTableCellElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

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

  const monthGroups = days.reduce<{ label: string; count: number }[]>((acc, day) => {
    const label = format(day, 'LLLL yyyy', { locale: ru })
    const last = acc[acc.length - 1]
    if (last && last.label === label) {
      last.count++
    } else {
      acc.push({ label, count: 1 })
    }
    return acc
  }, [])

  const bookingMap = new Map<string, Map<string, Booking>>()
  for (const booking of bookings) {
    if (!bookingMap.has(booking.property_id)) {
      bookingMap.set(booking.property_id, new Map())
    }
    const propMap = bookingMap.get(booking.property_id)!
    const checkIn = parseISO(booking.check_in)
    const visualEnd = getBookingVisualEndDate(booking as Booking)
    for (const day of eachDayOfInterval({ start: checkIn, end: visualEnd })) {
      propMap.set(format(day, 'yyyy-MM-dd'), booking as Booking)
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id || !onReorder) return
    const oldIndex = properties.findIndex(p => p.id === active.id)
    const newIndex = properties.findIndex(p => p.id === over.id)
    const reordered = arrayMove(properties, oldIndex, newIndex)
    onReorder(reordered.map(p => p.id))
  }

  if (properties.length === 0) {
    return (
      <div className="flex items-center justify-center flex-1 text-gray-400 text-sm py-16 px-4 text-center">
        Добавьте квартиры, чтобы увидеть шахматку
      </div>
    )
  }

  return (
    <div
      ref={scrollContainerRef}
      className="overflow-auto flex-1"
      style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
    >
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <table className="border-collapse" style={{ minWidth: 'max-content' }}>
          <thead>
          <tr>
            <th
              ref={leftSentinelRef}
              className="sticky top-0 bg-white"
              style={{ width: 1, minWidth: 1, padding: 0, border: 'none' }}
              aria-hidden="true"
            />
            <th
              className="sticky left-0 top-0 z-30 bg-white border-b border-r border-gray-200"
              style={{ minWidth: 100, height: 22 }}
            />
            {monthGroups.map(group => (
              <th
                key={group.label}
                colSpan={group.count}
                className="sticky top-0 z-10 bg-white border-b border-r border-gray-200 px-1 text-center text-[10px] text-gray-500 font-semibold capitalize"
                style={{ height: 22, minWidth: 36 }}
              >
                {group.label}
              </th>
            ))}
            <th
              ref={rightSentinelRef}
              className="sticky top-0 bg-white"
              style={{ width: 1, minWidth: 1, padding: 0, border: 'none' }}
              aria-hidden="true"
            />
          </tr>
          <tr>
            <th
              className="bg-white"
              style={{ width: 1, minWidth: 1, padding: 0, border: 'none' }}
              aria-hidden="true"
            />
            <th
              className="sticky left-0 z-30 bg-white border-b border-r border-gray-200 px-2 py-2 text-left text-xs text-gray-500 font-medium"
              style={{ minWidth: 100, top: 22 }}
            >
              Квартира
            </th>
            {days.map(day => {
              const today = isToday(day)
              const weekend = isDayWeekend(day)
              return (
                <th
                  key={day.toISOString()}
                  data-today={today ? 'true' : undefined}
                  className={`z-10 border-b border-gray-200 px-0.5 py-1 text-center ${
                    today ? 'bg-[#376E6F]/10' : weekend ? 'bg-gray-100' : 'bg-white'
                  }`}
                  style={{ minWidth: 36, top: 22, position: 'sticky' }}
                >
                  <div className={`text-[10px] font-medium leading-tight ${today ? 'text-[#376E6F]' : weekend ? 'text-gray-500' : 'text-gray-400'}`}>
                    {format(day, 'EEE', { locale: ru }).slice(0, 2)}
                  </div>
                  <div className={`text-xs leading-tight ${today ? 'font-bold text-[#376E6F]' : weekend ? 'font-semibold text-gray-600' : 'font-bold text-gray-700'}`}>
                    {format(day, 'd')}
                  </div>
                </th>
              )
            })}
            <th
              className="bg-white"
              style={{ width: 1, minWidth: 1, padding: 0, border: 'none' }}
              aria-hidden="true"
            />
          </tr>
          </thead>
          <SortableContext items={properties.map(p => p.id)} strategy={verticalListSortingStrategy}>
            <tbody>
              {properties.map(property => (
                <SortableMobileRow
                  key={property.id}
                  property={property}
                  days={days}
                  propBookings={bookingMap.get(property.id) ?? new Map()}
                  rowHeight={rowHeight}
                  showFullText={showFullText}
                  to={to}
                  onCellClick={onCellClick}
                  onBookingClick={onBookingClick}
                />
              ))}
            </tbody>
          </SortableContext>
        </table>
      </DndContext>
    </div>
  )
}
