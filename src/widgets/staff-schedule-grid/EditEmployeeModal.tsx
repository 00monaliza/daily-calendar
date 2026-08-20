import { useState } from 'react'
import { BottomSheet } from '@/widgets/bottom-sheet/BottomSheet'
import { toast } from '@/shared/ui/Toast'
import { useDeleteStaffEmployee, useUpdateStaffEmployee } from '@/entities/staff-employee/queries'
import type { StaffEmployee } from '@/entities/staff-employee/types'

interface Props {
  open: boolean
  employee: StaffEmployee
  onClose: () => void
}

export function EditEmployeeModal({ open, employee, onClose }: Props) {
  const [fullName, setFullName] = useState(employee.full_name)
  const [position, setPosition] = useState(employee.position ?? '')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const updateEmployee = useUpdateStaffEmployee()
  const deleteEmployee = useDeleteStaffEmployee()

  async function handleSave() {
    if (!fullName.trim()) {
      toast.error('Укажите имя')
      return
    }

    const { error } = await updateEmployee.mutateAsync({
      id: employee.id,
      data: { full_name: fullName.trim(), position: position.trim() || null },
    })

    if (error) {
      toast.error('Не удалось сохранить изменения')
      return
    }

    toast.success('Изменения сохранены')
    onClose()
  }

  async function handleDelete() {
    const { error } = await deleteEmployee.mutateAsync(employee.id)

    if (error) {
      toast.error('Не удалось удалить сотрудника')
      return
    }

    toast.success('Сотрудник удалён')
    onClose()
  }

  function handleClose() {
    setConfirmingDelete(false)
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={handleClose} title="Сотрудник">
      <div className="p-4 space-y-4">
        <label className="block text-sm">
          <span className="block text-gray-500 mb-1">Имя</span>
          <input
            type="text"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#376E6F]"
          />
        </label>
        <label className="block text-sm">
          <span className="block text-gray-500 mb-1">Должность</span>
          <input
            type="text"
            value={position}
            onChange={e => setPosition(e.target.value)}
            placeholder="Например, Server"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#376E6F]"
          />
        </label>
        <p className="text-xs text-gray-400">
          Логин: <span className="font-mono">{employee.login}</span> (нельзя изменить)
        </p>

        <button
          onClick={handleSave}
          disabled={updateEmployee.isPending}
          className="w-full md:w-auto md:block md:mx-auto bg-[#376E6F] text-white py-2.5 md:py-2 px-4 md:px-8 md:text-sm rounded-lg font-medium hover:bg-[#1C3334] transition-colors disabled:opacity-50"
        >
          {updateEmployee.isPending ? 'Сохранение...' : 'Сохранить'}
        </button>

        <div className="border-t border-gray-100 pt-4">
          {!confirmingDelete ? (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="w-full text-center text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Удалить сотрудника
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-600 text-center">
                Удалить {employee.full_name}? Это действие нельзя отменить — весь график сотрудника тоже будет удалён.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteEmployee.isPending}
                  className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {deleteEmployee.isPending ? 'Удаление...' : 'Да, удалить'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  )
}
