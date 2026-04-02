import { supabase } from '@/shared/api/supabaseClient'
import type { SettingsPatch } from './types'

export const settingsApi = {
  async get(userId: string) {
    return supabase.from('settings').select('*').eq('user_id', userId).single()
  },

  async upsert(userId: string, patch: SettingsPatch) {
    return supabase
      .from('settings')
      .upsert({ user_id: userId, ...patch })
      .select()
      .single()
  },
}
