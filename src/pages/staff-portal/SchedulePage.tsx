import { addDays, format, startOfWeek } from 'date-fns'
import { ru } from 'date-fns/locale'
import { SignOut } from '@phosphor-icons/react'
import { useNavigate } from 'react-router-dom'
import { signOut, useUser } from '@/features/auth/useUser'
import { useStaffEmployeeSelf } from '@/entities/staff-employee/queries'
import { useStaffShiftsForEmployee } from '@/entities/staff-shift/queries'
import { countWorkedDays } from '@/shared/lib/staffShiftHours'
import { findNextShift } from '@/shared/lib/staffNextShift'
import { contrastTextColor, hexToRgb } from '@/shared/lib/colorContrast'
import { SHIFT_STATUS_COLORS } from '@/shared/lib/shiftStatusColors'
import type { StaffShiftStatus } from '@/entities/staff-shift/types'

const STATUS_LABEL: Record<string, string> = {
  work: '',
  day_off: 'Выходной',
  vacation: 'Отпуск',
  sick: 'Больничный',
}

export function StaffPortalSchedulePage() {
  const { user } = useUser()
  const navigate = useNavigate()
  const { data: employee } = useStaffEmployeeSelf(user?.id)

  const today = new Date()
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })
  const fromDate = format(weekStart, 'yyyy-MM-dd')
  const toDate = format(addDays(weekStart, 6), 'yyyy-MM-dd')
  const todayStr = format(today, 'yyyy-MM-dd')

  const { data: shifts = [] } = useStaffShiftsForEmployee(employee?.id, fromDate, toDate)

  const weekWorkedDays = countWorkedDays(
    shifts.map(s => ({ status: s.status, start_time: s.start_time, end_time: s.end_time }))
  )
  const nextShift = findNextShift(shifts, todayStr)

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  if (!employee) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <div>
          <div className="text-sm font-semibold text-gray-800">{employee.full_name}</div>
          {employee.position && <div className="text-xs text-gray-500">{employee.position}</div>}
        </div>
        <button onClick={handleLogout} className="text-gray-400 hover:text-gray-600" aria-label="Выйти">
          <SignOut size={20} />
        </button>
      </div>

      <div className="p-4 space-y-4 max-w-md mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Следующая смена</div>
          {nextShift ? (
            <>
              <div className="text-2xl font-bold text-[#376E6F] tabular-nums">
                {nextShift.date === todayStr ? 'Сегодня' : format(new Date(nextShift.date), 'd MMMM', { locale: ru })}
                {', '}
                {nextShift.start_time?.slice(0, 5)}–{nextShift.end_time?.slice(0, 5)}
              </div>
              {employee.position && <div className="text-sm text-gray-500 mt-1">{employee.position}</div>}
            </>
          ) : (
            <div className="text-sm text-gray-400">Нет запланированных смен</div>
          )}
        </div>

        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <div className="text-4xl font-bold text-[#376E6F] tabular-nums">{weekWorkedDays}</div>
          <div className="text-xs text-gray-500 mt-1">Дней отработано на этой неделе</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {shifts.map(shift => {
            const colors = SHIFT_STATUS_COLORS[shift.status as StaffShiftStatus]
            const { r, g, b } = hexToRgb(colors.bg)
            const textColor = contrastTextColor(r, g, b)

            return (
              <div
                key={shift.id}
                className="flex items-center justify-between border-b border-gray-100 last:border-0 px-4 py-2.5"
              >
                <span className="text-sm text-gray-700">{format(new Date(shift.date), 'EEE d MMM', { locale: ru })}</span>
                <span
                  className="text-xs font-semibold tabular-nums px-2 py-1 rounded-full"
                  style={{ backgroundColor: colors.bg, color: textColor }}
                >
                  {shift.status === 'work'
                    ? `${shift.start_time?.slice(0, 5)}–${shift.end_time?.slice(0, 5)}`
                    : STATUS_LABEL[shift.status]}
                </span>
              </div>
            )
          })}
          {shifts.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-gray-400">На этой неделе нет смен</div>
          )}
        </div>
      </div>
    </div>
  )
}
