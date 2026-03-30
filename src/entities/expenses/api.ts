import { supabase } from '@/shared/api/supabaseClient'
import type { ExpenseInsert } from './types'

export const expensesApi = {
  async getByPeriod(ownerId: string, from: string, to: string) {
    return supabase
      .from('expenses')
      .select('*, properties(name,color)')
      .eq('owner_id', ownerId)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: false })
  },

  async create(data: ExpenseInsert) {
    return supabase.from('expenses').insert(data).select().single()
  },
}
