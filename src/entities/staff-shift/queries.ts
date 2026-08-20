import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { staffShiftApi } from './api'
import type { StaffShiftUpsert } from './types'

export function useStaffShifts(ownerId: string | undefined, fromDate: string, toDate: string) {
  return useQuery({
    queryKey: ['staff-shifts', ownerId, fromDate, toDate],
    queryFn: async () => {
      if (!ownerId) return []
      const { data, error } = await staffShiftApi.getRange(ownerId, fromDate, toDate)
      if (error) throw error
      return data ?? []
    },
    enabled: !!ownerId,
    staleTime: 30_000,
  })
}

export function useUpsertStaffShift() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: StaffShiftUpsert) => staffShiftApi.upsert(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff-shifts'] }),
  })
}
