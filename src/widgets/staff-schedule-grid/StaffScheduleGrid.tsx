import { useState } from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ShiftCell } from './ShiftCell'
import { ShiftEditModal } from './ShiftEditModal'
import { countWorkedDays } from '@/shared/lib/staffShiftHours'
import type { StaffEmployee } from '@/entities/staff-employee/types'
import type { StaffShift } from '@/entities/staff-shift/types'

interface Props {
  ownerId: string
  employees: StaffEmployee[]
  shifts: StaffShift[]
  days: Date[]
}

function shiftKey(employeeId: string, dateStr: string) {
  return `${employeeId}_${dateStr}`
}

export function StaffScheduleGrid({ ownerId, employees, shifts, days }: Props) {
  const [editing, setEditing] = useState<{ employeeId: string; date: string } | null>(null)

  const shiftsByKey = new Map<string, StaffShift>()
  for (const shift of shifts) {
    shiftsByKey.set(shiftKey(shift.employee_id, shift.date), shift)
  }

  const dayTotals = days.map(day => {
    const dateStr = format(day, 'yyyy-MM-dd')
    return employees.reduce((count, emp) => {
      const shift = shiftsByKey.get(shiftKey(emp.id, dateStr))
      return shift?.status === 'work' ? count + 1 : count
    }, 0)
  })
  const maxDayTotal = Math.max(1, ...dayTotals)

  const editingShift = editing
    ? shiftsByKey.get(shiftKey(editing.employeeId, editing.date))
    : undefined

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-scroll">
        <table className="w-full border-collapse min-w-[640px]">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left text-xs font-medium text-gray-500 px-3 py-2 sticky left-0 bg-gray-50 z-10">
                Сотрудник
              </th>
              {days.map((day, i) => (
                <th key={day.toISOString()} className="px-2 py-2 min-w-[80px]">
                  <div className="text-xs font-medium text-gray-600">
                    {format(day, 'EEE d MMM', { locale: ru })}
                  </div>
                  <div className="mt-1 h-[3px] bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#376E6F]/40 rounded-full"
                      style={{ width: `${(dayTotals[i] / maxDayTotal) * 100}%` }}
                    />
                  </div>
                </th>
              ))}
              <th className="text-right text-xs font-medium text-gray-500 px-3 py-2">Дни</th>
            </tr>
          </thead>
          <tbody>
            {employees.map(employee => {
              const employeeShifts = days.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd')
                return shiftsByKey.get(shiftKey(employee.id, dateStr))
              })
              const workedDays = countWorkedDays(
                employeeShifts.map(s => ({
                  status: s?.status ?? 'day_off',
                  start_time: s?.start_time ?? null,
                  end_time: s?.end_time ?? null,
                }))
              )

              return (
                <tr key={employee.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-3 py-2 sticky left-0 bg-white z-10">
                    <div className="text-sm font-semibold text-gray-800">{employee.full_name}</div>
                    {employee.position && (
                      <div className="text-[11px] text-gray-500">{employee.position}</div>
                    )}
                  </td>
                  {days.map((day, i) => {
                    const dateStr = format(day, 'yyyy-MM-dd')
                    return (
                      <td key={dateStr} className="p-0 border-l border-gray-100">
                        <ShiftCell
                          shift={employeeShifts[i]}
                          onClick={() => setEditing({ employeeId: employee.id, date: dateStr })}
                        />
                      </td>
                    )
                  })}
                  <td className="px-3 py-2 text-right text-sm font-bold text-[#376E6F] tabular-nums">
                    {workedDays}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <ShiftEditModal
          open
          ownerId={ownerId}
          employeeId={editing.employeeId}
          employeeAuthUserId={employees.find(e => e.id === editing.employeeId)?.auth_user_id ?? null}
          date={editing.date}
          existingShift={editingShift}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
