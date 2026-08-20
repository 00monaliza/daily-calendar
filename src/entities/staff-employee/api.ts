import { supabase } from '@/shared/api/supabaseClient'
import { normalizeStaffLogin } from '@/shared/lib/staffAuthEmail'
import type { StaffEmployeeInsert, StaffEmployeeUpdate } from './types'

export const staffEmployeeApi = {
  async getAll(ownerId: string) {
    return supabase
      .from('staff_employees')
      .select('*')
      .eq('owner_id', ownerId)
      .order('sort_order', { nullsFirst: false })
      .order('created_at')
  },

  async getByAuthUserId(authUserId: string) {
    return supabase.from('staff_employees').select('*').eq('auth_user_id', authUserId).maybeSingle()
  },

  async create(data: StaffEmployeeInsert) {
    return supabase
      .from('staff_employees')
      .insert({ ...data, login: normalizeStaffLogin(data.login) })
      .select()
      .single()
  },

  async update(id: string, data: StaffEmployeeUpdate) {
    return supabase.from('staff_employees').update(data).eq('id', id).select().single()
  },

  async delete(id: string) {
    return supabase.from('staff_employees').delete().eq('id', id)
  },

  async reorder(ids: string[]) {
    return Promise.all(
      ids.map((id, index) =>
        supabase.from('staff_employees').update({ sort_order: index }).eq('id', id)
      )
    )
  },
}
