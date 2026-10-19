import { supabase } from '@/shared/api/supabaseClient'
import type { VoiceDraftStatus } from './types'

export const VOICE_BOOKING_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1/voice-booking`

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
}

export const voiceBookingApi = {
  async getDraft(id: string) {
    return supabase.from('voice_booking_drafts').select('*').eq('id', id).maybeSingle()
  },

  async getPending(ownerId: string) {
    return supabase
      .from('voice_booking_drafts')
      .select('*')
      .eq('owner_id', ownerId)
      .eq('status', 'pending')
      // Older drafts are stale: the dictated "tomorrow" has likely passed.
      .gte('created_at', new Date(Date.now() - 7 * 86_400_000).toISOString())
      .order('created_at', { ascending: false })
  },

  async setStatus(id: string, status: VoiceDraftStatus) {
    return supabase.from('voice_booking_drafts').update({ status }).eq('id', id)
  },

  async hasToken(ownerId: string) {
    return supabase.from('voice_tokens').select('created_at').eq('owner_id', ownerId).maybeSingle()
  },

  /** Replaces the owner's token; the plain value is returned once and never stored. */
  async rotateToken(ownerId: string) {
    const token = randomToken()
    const { error } = await supabase
      .from('voice_tokens')
      .upsert({ owner_id: ownerId, token_hash: await sha256Hex(token), created_at: new Date().toISOString() })
    return { token: error ? null : token, error }
  },
}
