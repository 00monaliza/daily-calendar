import { useQuery } from '@tanstack/react-query'
import { guestApi } from './api'

export function useGuests(ownerId: string | undefined) {
  return useQuery({
    queryKey: ['guests', ownerId],
    queryFn: async () => {
      if (!ownerId) return []
      const { data, error } = await guestApi.getAll(ownerId)
      if (error) throw error
      return data ?? []
    },
    enabled: !!ownerId,
    staleTime: 30_000,
  })
}
