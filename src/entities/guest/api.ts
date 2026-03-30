import { supabase } from '@/shared/api/supabaseClient'

export const guestApi = {
  async getAll(ownerId: string) {
    return supabase
      .from('bookings')
      .select('guest_name, guest_phone, check_in, check_out, total_price, payment_status, properties(name)')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
  },
}
