import { supabase } from '@/shared/api/supabaseClient'
import type { BookingInsert, BookingUpdate } from './types'

export const bookingApi = {
  async getByDateRange(ownerId: string, from: string, to: string) {
    return supabase
      .from('bookings')
      .select('*, properties(name,color)')
      .eq('owner_id', ownerId)
      .gte('check_out', from)
      .lte('check_in', to)
      .order('check_in')
  },

  async getAll(ownerId: string) {
    return supabase
      .from('bookings')
      .select('*, properties(name,color)')
      .eq('owner_id', ownerId)
      .order('check_in', { ascending: false })
  },

  async create(data: BookingInsert) {
    return supabase.from('bookings').insert(data).select().single()
  },

  async update(id: string, data: BookingUpdate) {
    return supabase.from('bookings').update(data).eq('id', id).select().single()
  },

  async delete(id: string) {
    return supabase.from('bookings').delete().eq('id', id)
  },
}
