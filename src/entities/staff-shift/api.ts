import { supabase } from '@/shared/api/supabaseClient'
import type { StaffShiftUpsert } from './types'

export const staffShiftApi = {
  async getRange(ownerId: string, fromDate: string, toDate: string) {
    return supabase
      .from('staff_shifts')
      .select('*')
      .eq('owner_id', ownerId)
      .gte('date', fromDate)
      .lte('date', toDate)
  },

  async upsert(data: StaffShiftUpsert) {
    return supabase
      .from('staff_shifts')
      .upsert(data, { onConflict: 'employee_id,date' })
      .select()
      .single()
  },

  async delete(employeeId: string, date: string) {
    return supabase.from('staff_shifts').delete().eq('employee_id', employeeId).eq('date', date)
  },
}
