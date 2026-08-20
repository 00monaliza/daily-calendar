import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { staffEmployeeApi } from './api'
import type { StaffEmployeeInsert, StaffEmployeeUpdate } from './types'

export function useStaffEmployees(ownerId: string | undefined) {
  return useQuery({
    queryKey: ['staff-employees', ownerId],
    queryFn: async () => {
      if (!ownerId) return []
      const { data, error } = await staffEmployeeApi.getAll(ownerId)
      if (error) throw error
      return data ?? []
    },
    enabled: !!ownerId,
    staleTime: 60_000,
  })
}

export function useCreateStaffEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: StaffEmployeeInsert) => staffEmployeeApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff-employees'] }),
  })
}

export function useUpdateStaffEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: StaffEmployeeUpdate }) =>
      staffEmployeeApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff-employees'] }),
  })
}

export function useReorderStaffEmployees() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => staffEmployeeApi.reorder(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff-employees'] }),
  })
}
