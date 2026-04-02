import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@/features/auth/useUser'
import { settingsApi } from './api'
import { DEFAULT_SETTINGS } from './types'
import type { SettingsPatch, UserSettings } from './types'

export function useSettings() {
  const { user } = useUser()
  return useQuery({
    queryKey: ['settings', user?.id],
    queryFn: async (): Promise<UserSettings> => {
      if (!user) throw new Error('Not authenticated')
      const { data, error } = await settingsApi.get(user.id)
      // PGRST116 = no rows found — first time user, return defaults
      if (error && error.code !== 'PGRST116') throw error
      if (!data) return { user_id: user.id, ...DEFAULT_SETTINGS }
      return data as UserSettings
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  })
}

export function useUpdateSettings() {
  const { user } = useUser()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: SettingsPatch) => {
      if (!user) throw new Error('Not authenticated')
      return settingsApi.upsert(user.id, patch)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })
}
