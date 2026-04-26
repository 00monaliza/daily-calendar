import type { Booking, BookingWithProperty } from '@/entities/booking/types'
import type { Property } from '@/entities/property/types'

interface Props {
  bookings: (Booking | BookingWithProperty)[]
  properties: Property[]
  from: string
  to: string
}

export function SummaryBar(props: Props) {
  void props
  // Временно скрыто по запросу: блок сводных метрик не рендерим.
  return null
}
