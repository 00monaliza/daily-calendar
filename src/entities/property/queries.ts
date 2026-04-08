import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { propertyApi } from './api'
import type { PropertyInsert, PropertyUpdate } from './types'

export function useProperties(ownerId: string | undefined) {
  return useQuery({
    queryKey: ['properties', ownerId],
    queryFn: async () => {
      if (!ownerId) return []
      const { data, error } = await propertyApi.getAll(ownerId)
      if (error) throw error
      return data ?? []
    },
    enabled: !!ownerId,
    staleTime: 60_000,
  })
}

export function useCreateProperty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: PropertyInsert) => propertyApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  })
}

export function useUpdateProperty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: PropertyUpdate }) =>
      propertyApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  })
}

export function useDeleteProperty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => propertyApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  })
}

export function useReorderProperties() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => propertyApi.reorder(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  })
}
