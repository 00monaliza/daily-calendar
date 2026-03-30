import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { expensesApi } from './api'
import type { ExpenseInsert } from './types'

export function useExpenses(ownerId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: ['expenses', ownerId, from, to],
    queryFn: async () => {
      if (!ownerId) return []
      const { data, error } = await expensesApi.getByPeriod(ownerId, from, to)
      if (error) throw error
      return data ?? []
    },
    enabled: !!ownerId,
    staleTime: 30_000,
  })
}

export function useCreateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ExpenseInsert) => expensesApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  })
}
