import type { AvailabilityReport } from '@/shared/lib/bookingAvailability'
import type { VoiceBookingParsed } from '@/shared/lib/voiceBooking'

export type VoiceDraftStatus = 'pending' | 'used' | 'dismissed'

export interface VoiceBookingDraft {
  id: string
  owner_id: string
  transcript: string
  parsed: VoiceBookingParsed
  availability: AvailabilityReport | null
  status: VoiceDraftStatus
  created_at: string
}
