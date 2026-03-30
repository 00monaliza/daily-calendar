import { supabase } from '@/shared/api/supabaseClient'
import type { PropertyInsert, PropertyUpdate } from './types'

export const propertyApi = {
  async getAll(ownerId: string) {
    return supabase
      .from('properties')
      .select('*')
      .eq('owner_id', ownerId)
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
}
