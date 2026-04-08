import { useMemo, useState, type FormEvent } from 'react'
import { format, startOfMonth } from 'date-fns'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Property } from '@/entities/property/types'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import { supabase } from '@/shared/api/supabaseClient'
import { toast } from '@/shared/ui/Toast'
import { BottomSheet } from '@/widgets/bottom-sheet/BottomSheet'
import {
  buildExpenseDescriptionWithMeta,
  EXPENSE_CATEGORY_OPTIONS,
  getExpenseCategoryDbValue,
} from './constants'

interface Props {
  open: boolean
  ownerId: string | undefined
  properties: Property[]
  prefillPropertyId: string | null
  defaultDate: Date
  onClose: () => void
}

export function ExpenseModal({
  open,
  ownerId,
  properties,
  prefillPropertyId,
  defaultDate,
  onClose,
}: Props) {
  const isMobile = useIsMobile()
  const queryClient = useQueryClient()

  const defaultDateValue = useMemo(
    () => format(startOfMonth(defaultDate), 'yyyy-MM-dd'),
    [defaultDate],
  )
  const initialPropertyId = prefillPropertyId ?? properties[0]?.id ?? ''

  const [propertyId, setPropertyId] = useState(initialPropertyId)
  const [categoryLabel, setCategoryLabel] = useState<string>('Прочее')
  const [amount, setAmount] = useState('')
  const [expenseDate, setExpenseDate] = useState(defaultDateValue)
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  const createExpense = useMutation({
    mutationFn: async (payload: {
      owner_id: string
      property_id: string
      amount: number
      category: string
      date: string
      description: string | null
    }) => {
      const { data, error: insertError } = await supabase
        .from('expenses')
        .insert(payload)
        .select()
        .single()

      if (insertError) throw insertError
      return data
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['finance-data'] })
      await queryClient.invalidateQueries({ queryKey: ['expenses'] })
      toast.success('Расход добавлен')
      onClose()
    },
    onError: err => {
      const message = err instanceof Error ? err.message : 'Не удалось сохранить расход'
      setError(message)
      toast.error('Не удалось сохранить расход')
    },
  })

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    if (!ownerId) {
      setError('Сессия пользователя не найдена')
      return
    }

    if (!propertyId) {
      setError('Выберите квартиру')
      return
    }

    const normalizedAmount = Number(amount)
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      setError('Укажите корректную сумму')
      return
    }

    setError(null)

    await createExpense.mutateAsync({
      owner_id: ownerId,
      property_id: propertyId,
      amount: Math.round(normalizedAmount),
      category: getExpenseCategoryDbValue(categoryLabel),
      date: expenseDate,
      description: buildExpenseDescriptionWithMeta(categoryLabel, description),
    })
  }

  if (!open) return null

  const formContent = (
    <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Квартира *</label>
        <select
          required
          value={propertyId}
          onChange={event => setPropertyId(event.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D9D8F]"
        >
          {properties.map(property => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Категория *</label>
        <select
          required
          value={categoryLabel}
          onChange={event => setCategoryLabel(event.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D9D8F]"
        >
          {EXPENSE_CATEGORY_OPTIONS.map(option => (
            <option key={option.label} value={option.label}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Сумма (₸) *</label>
        <input
          required
          type="number"
          min={1}
          step={1}
          value={amount}
          onChange={event => setAmount(event.target.value)}
          placeholder="Например: 25000"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D9D8F]"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Дата *</label>
        <input
          required
          type="date"
          value={expenseDate}
          onChange={event => setExpenseDate(event.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D9D8F]"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
        <input
          type="text"
          value={description}
          onChange={event => setDescription(event.target.value)}
          placeholder="Опционально"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D9D8F]"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Отмена
        </button>
        <button
          type="submit"
          disabled={createExpense.isPending}
          className="flex-1 bg-[#2D9D8F] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#257C71] transition-colors disabled:opacity-50"
        >
          {createExpense.isPending ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </form>
  )

  if (isMobile) {
    return (
      <BottomSheet open onClose={onClose} title="Добавить расход">
        {formContent}
      </BottomSheet>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Добавить расход</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl" aria-label="Закрыть">
            ✕
          </button>
        </div>
        {formContent}
      </div>
    </div>
  )
}
