import { supabase } from '@/shared/api/supabaseClient'
import type { PropertyInsert, PropertyUpdate } from './types'

export const propertyApi = {
  async getAll(ownerId: string) {
    return supabase
      .from('properties')
      .select('*')
      .eq('owner_id', ownerId)
      .order('sort_order', { nullsFirst: false })
      .order('created_at')
  },

  async create(data: PropertyInsert) {
    return supabase.from('properties').insert(data).select().single()
  },

  async update(id: string, data: PropertyUpdate) {
    return supabase.from('properties').update(data).eq('id', id).select().single()
  },

  async delete(id: string) {
    return supabase.from('properties').delete().eq('id', id)
  },

  async reorder(ids: string[]) {
    return Promise.all(
      ids.map((id, index) =>
        supabase.from('properties').update({ sort_order: index }).eq('id', id)
      )
    )
  },
}
