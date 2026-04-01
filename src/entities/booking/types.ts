export type PaymentStatus = 'waiting' | 'partial' | 'paid'
export type BookingSource = 'direct' | 'kaspi' | 'booking' | 'airbnb' | 'avito' | 'other'

export interface Booking {
  id: string
  property_id: string
  owner_id: string
  guest_name: string
  guest_phone: string | null
  check_in: string // ISO date: 'YYYY-MM-DD'
  check_out: string
  total_price: number
  prepayment: number
  payment_status: PaymentStatus
  source: BookingSource
  comment: string | null
  created_at: string
}

export interface BookingWithProperty extends Booking {
  properties: {
    name: string
    color: string
  } | null
}

export type BookingInsert = Omit<Booking, 'id' | 'created_at'>
export type BookingUpdate = Partial<BookingInsert>
