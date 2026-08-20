import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { BottomSheet } from '@/widgets/bottom-sheet/BottomSheet'
import { PinInput } from '@/shared/ui/PinInput'
import { toast } from '@/shared/ui/Toast'
import { supabase } from '@/shared/api/supabaseClient'
import type { StaffEmployee } from '@/entities/staff-employee/types'

interface Props {
  open: boolean
  employee: StaffEmployee
  onClose: () => void
}

export function EmployeeAccessModal({ open, employee, onClose }: Props) {
  const [pin, setPin] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const qc = useQueryClient()
  const hasAccess = !!employee.auth_user_id

  async function handleSubmit() {
    if (pin.length < 4) {
      toast.error('PIN должен быть не короче 4 цифр')
      return
    }

    setSubmitting(true)
    const { error } = await supabase.functions.invoke('staff-provision-employee', {
      body: { employee_id: employee.id, pin },
    })
    setSubmitting(false)

    if (error) {
      toast.error('Не удалось выдать доступ')
      return
    }

    toast.success(hasAccess ? 'PIN обновлён' : 'Доступ выдан')
    qc.invalidateQueries({ queryKey: ['staff-employees'] })
    setPin('')
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={hasAccess ? 'Сбросить PIN' : 'Выдать доступ'}>
      <div className="p-4 space-y-4">
        <p className="text-sm text-gray-500">
          Логин: <span className="font-mono">{employee.login}</span>. Сообщите сотруднику логин и PIN лично —
          это единственный способ входа на staff.pogostim.kz.
        </p>
        <PinInput value={pin} onChange={setPin} autoFocus />
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-[#376E6F] text-white py-2.5 rounded-lg font-medium hover:bg-[#1C3334] transition-colors disabled:opacity-50"
        >
          {submitting ? 'Сохранение...' : hasAccess ? 'Обновить PIN' : 'Выдать доступ'}
        </button>
      </div>
    </BottomSheet>
  )
}
