import { useState } from 'react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { BottomSheet } from '@/widgets/bottom-sheet/BottomSheet'
import { EmployeeAccessModal } from './EmployeeAccessModal'
import { Toggle } from '@/shared/ui/Toggle'
import { toast } from '@/shared/ui/Toast'
import {
  useCreateStaffEmployee,
  useReorderStaffEmployees,
  useUpdateStaffEmployee,
} from '@/entities/staff-employee/queries'
import type { StaffEmployee } from '@/entities/staff-employee/types'

interface Props {
  ownerId: string
  employees: StaffEmployee[]
}

function SortableEmployeeRow({ employee, onManageAccess }: { employee: StaffEmployee; onManageAccess: (employee: StaffEmployee) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: employee.id,
  })
  const updateEmployee = useUpdateStaffEmployee()

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 border-b border-gray-100 last:border-0 px-3 py-2.5"
    >
      <button {...attributes} {...listeners} className="text-gray-300 hover:text-gray-500 cursor-grab flex-shrink-0">
        ⠿
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-800 truncate">{employee.full_name}</div>
        {employee.position && <div className="text-xs text-gray-500 truncate">{employee.position}</div>}
      </div>
      <button
        onClick={() => onManageAccess(employee)}
        className="text-xs font-medium text-[#376E6F] hover:underline flex-shrink-0"
      >
        {employee.auth_user_id ? 'PIN ✓' : 'Доступ'}
      </button>
      <Toggle
        checked={employee.is_active}
        onChange={checked => updateEmployee.mutate({ id: employee.id, data: { is_active: checked } })}
      />
    </div>
  )
}

function AddEmployeeModal({ ownerId, open, onClose }: { ownerId: string; open: boolean; onClose: () => void }) {
  const [fullName, setFullName] = useState('')
  const [position, setPosition] = useState('')
  const [login, setLogin] = useState('')
  const createEmployee = useCreateStaffEmployee()

  async function handleSave() {
    if (!fullName.trim() || !login.trim()) {
      toast.error('Укажите имя и логин')
      return
    }

    const { error } = await createEmployee.mutateAsync({
      owner_id: ownerId,
      full_name: fullName.trim(),
      position: position.trim() || null,
      login: login.trim(),
    })

    if (error) {
      toast.error(error.message.includes('duplicate') ? 'Такой логин уже занят' : 'Не удалось добавить сотрудника')
      return
    }

    toast.success('Сотрудник добавлен')
    setFullName('')
    setPosition('')
    setLogin('')
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Новый сотрудник">
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
        <label className="block text-sm">
          <span className="block text-gray-500 mb-1">Логин (телефон или имя пользователя)</span>
          <input
            type="text"
            value={login}
            onChange={e => setLogin(e.target.value)}
            placeholder="+7 707 123 45 67"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#376E6F]"
          />
        </label>
        <button
          onClick={handleSave}
          disabled={createEmployee.isPending}
          className="w-full bg-[#376E6F] text-white py-2.5 rounded-lg font-medium hover:bg-[#1C3334] transition-colors disabled:opacity-50"
        >
          {createEmployee.isPending ? 'Сохранение...' : 'Добавить'}
        </button>
      </div>
    </BottomSheet>
  )
}

export function StaffEmployeeListPanel({ ownerId, employees }: Props) {
  const [addOpen, setAddOpen] = useState(false)
  const [accessEmployee, setAccessEmployee] = useState<StaffEmployee | null>(null)
  const reorderEmployees = useReorderStaffEmployees()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = employees.findIndex(e => e.id === active.id)
    const newIndex = employees.findIndex(e => e.id === over.id)
    const reordered = arrayMove(employees, oldIndex, newIndex)
    reorderEmployees.mutate(reordered.map(e => e.id))
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-800">Сотрудники</h3>
        <button
          onClick={() => setAddOpen(true)}
          className="text-xs font-medium text-[#376E6F] hover:underline"
        >
          + Добавить
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={employees.map(e => e.id)} strategy={verticalListSortingStrategy}>
          {employees.map(employee => (
            <SortableEmployeeRow key={employee.id} employee={employee} onManageAccess={setAccessEmployee} />
          ))}
        </SortableContext>
      </DndContext>

      {employees.length === 0 && (
        <div className="px-3 py-6 text-center text-sm text-gray-400">Пока нет сотрудников</div>
      )}

      <AddEmployeeModal ownerId={ownerId} open={addOpen} onClose={() => setAddOpen(false)} />

      {accessEmployee && (
        <EmployeeAccessModal
          open
          employee={accessEmployee}
          onClose={() => setAccessEmployee(null)}
        />
      )}
    </div>
  )
}
