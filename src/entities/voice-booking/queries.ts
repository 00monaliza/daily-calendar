import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { voiceBookingApi } from './api'
import type { VoiceBookingDraft, VoiceDraftStatus } from './types'

export function useVoiceDraft(id: string | null) {
  return useQuery({
    queryKey: ['voice-draft', id],
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await voiceBookingApi.getDraft(id)
      if (error) throw error
      return (data ?? null) as VoiceBookingDraft | null
    },
    enabled: !!id,
  })
}

export function usePendingVoiceDrafts(ownerId: string | undefined) {
  return useQuery({
    queryKey: ['voice-drafts-pending', ownerId],
    queryFn: async () => {
      if (!ownerId) return []
      const { data, error } = await voiceBookingApi.getPending(ownerId)
      // Missing table (migration 007 not applied yet) should not break the calendar.
      if (error) return []
      return (data ?? []) as VoiceBookingDraft[]
    },
    enabled: !!ownerId,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  })
}

export function useSetVoiceDraftStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: VoiceDraftStatus }) => voiceBookingApi.setStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['voice-drafts-pending'] })
      qc.invalidateQueries({ queryKey: ['voice-draft'] })
    },
  })
}

export function useVoiceTokenStatus(ownerId: string | undefined) {
  return useQuery({
    queryKey: ['voice-token', ownerId],
    queryFn: async () => {
      if (!ownerId) return null
      const { data, error } = await voiceBookingApi.hasToken(ownerId)
      if (error) return null
      return (data?.created_at as string | undefined) ?? null
    },
    enabled: !!ownerId,
  })
}

export function useRotateVoiceToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ownerId: string) => {
      const { token, error } = await voiceBookingApi.rotateToken(ownerId)
      if (error || !token) throw error ?? new Error('Не удалось создать токен')
      return token
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['voice-token'] }),
  })
}
