import { useState } from 'react'
import { BottomSheet } from '@/widgets/bottom-sheet/BottomSheet'
import { toast } from '@/shared/ui/Toast'
import { useUpsertStaffShift } from '@/entities/staff-shift/queries'
import type { StaffShift, StaffShiftStatus } from '@/entities/staff-shift/types'

const STATUS_OPTIONS: { value: StaffShiftStatus; label: string }[] = [
  { value: 'work', label: 'Смена' },
  { value: 'day_off', label: 'Выходной' },
  { value: 'vacation', label: 'Отпуск' },
  { value: 'sick', label: 'Больничный' },
]

interface Props {
  open: boolean
  ownerId: string
  employeeId: string
  date: string
  existingShift: StaffShift | undefined
  onClose: () => void
}

export function ShiftEditModal({ open, ownerId, employeeId, date, existingShift, onClose }: Props) {
  const [status, setStatus] = useState<StaffShiftStatus>(existingShift?.status ?? 'work')
  const [startTime, setStartTime] = useState(existingShift?.start_time?.slice(0, 5) ?? '08:00')
  const [endTime, setEndTime] = useState(existingShift?.end_time?.slice(0, 5) ?? '17:00')
  const [note, setNote] = useState(existingShift?.note ?? '')
  const upsert = useUpsertStaffShift()

  async function handleSave() {
    const { error } = await upsert.mutateAsync({
      owner_id: ownerId,
      employee_id: employeeId,
      date,
      status,
      start_time: status === 'work' ? startTime : null,
      end_time: status === 'work' ? endTime : null,
      note: note || null,
    })

    if (error) {
      toast.error('Не удалось сохранить смену')
      return
    }

    toast.success('Смена сохранена')
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Смена">
      <div className="p-4 space-y-4">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatus(opt.value)}
              className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors ${
                status === opt.value ? 'bg-[#376E6F] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {status === 'work' && (
          <div className="flex gap-3">
            <label className="flex-1 text-sm">
              <span className="block text-gray-500 mb-1">Начало</span>
              <input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#376E6F]"
              />
            </label>
            <label className="flex-1 text-sm">
              <span className="block text-gray-500 mb-1">Конец</span>
              <input
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#376E6F]"
              />
            </label>
          </div>
        )}

        <label className="block text-sm">
          <span className="block text-gray-500 mb-1">Заметка</span>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Например, Shift Lead"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#376E6F]"
          />
        </label>

        <button
          onClick={handleSave}
          disabled={upsert.isPending}
          className="w-full bg-[#376E6F] text-white py-2.5 rounded-lg font-medium hover:bg-[#1C3334] transition-colors disabled:opacity-50"
        >
          {upsert.isPending ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </BottomSheet>
  )
}
