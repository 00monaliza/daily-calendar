import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { bookingApi } from './api'
import type { BookingInsert, BookingUpdate } from './types'

export function useBookings(ownerId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: ['bookings', ownerId, from, to],
    queryFn: async () => {
      if (!ownerId) return []
      const { data, error } = await bookingApi.getByDateRange(ownerId, from, to)
      if (error) throw error
      return data ?? []
    },
    enabled: !!ownerId,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })
}

export function useAllBookings(ownerId: string | undefined) {
  return useQuery({
    queryKey: ['bookings-all', ownerId],
    queryFn: async () => {
      if (!ownerId) return []
      const { data, error } = await bookingApi.getAll(ownerId)
      if (error) throw error
      return data ?? []
    },
    enabled: !!ownerId,
    staleTime: 30_000,
  })
}

export function useCreateBooking() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: BookingInsert) => bookingApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] })
      qc.invalidateQueries({ queryKey: ['bookings-all'] })
    },
  })
}

export function useUpdateBooking() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: BookingUpdate }) =>
      bookingApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] })
      qc.invalidateQueries({ queryKey: ['bookings-all'] })
    },
  })
}

export function useDeleteBooking() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => bookingApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] })
      qc.invalidateQueries({ queryKey: ['bookings-all'] })
    },
  })
}
