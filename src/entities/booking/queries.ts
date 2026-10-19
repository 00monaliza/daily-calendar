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

/**
 * Bookings for an availability check. Unlike useBookings there is no
 * placeholder data: a result for a previous date range must never be read
 * as "free" for the current one.
 */
export function useBookingsForAvailability(ownerId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: ['bookings', ownerId, from, to, 'availability'],
    queryFn: async () => {
      if (!ownerId) return []
      const { data, error } = await bookingApi.getByDateRange(ownerId, from, to)
      if (error) throw error
      return data ?? []
    },
    enabled: !!ownerId,
    staleTime: 15_000,
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
    mutationFn: async (data: BookingInsert) => {
      const { data: row, error } = await bookingApi.create(data)
      if (error) throw error
      return row
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] })
      qc.invalidateQueries({ queryKey: ['bookings-all'] })
    },
  })
}

export function useUpdateBooking() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: BookingUpdate }) => {
      const { data: row, error } = await bookingApi.update(id, data)
      if (error) throw error
      return row
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] })
      qc.invalidateQueries({ queryKey: ['bookings-all'] })
    },
  })
}

export function useDeleteBooking() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await bookingApi.delete(id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] })
      qc.invalidateQueries({ queryKey: ['bookings-all'] })
    },
  })
}
