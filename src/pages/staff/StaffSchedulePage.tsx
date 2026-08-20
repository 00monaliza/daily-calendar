import { useState } from 'react'
import { addDays, addWeeks, eachDayOfInterval, endOfWeek, format, startOfWeek, subWeeks } from 'date-fns'
import { ru } from 'date-fns/locale'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { useUser } from '@/features/auth/useUser'
import { useStaffEmployees } from '@/entities/staff-employee/queries'
import { useStaffShifts } from '@/entities/staff-shift/queries'
import { StaffEmployeeListPanel } from '@/widgets/staff-schedule-grid/StaffEmployeeListPanel'
import { StaffScheduleGrid } from '@/widgets/staff-schedule-grid/StaffScheduleGrid'

export function StaffSchedulePage() {
  const { user } = useUser()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))

  const days = eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) })
  const fromDate = format(weekStart, 'yyyy-MM-dd')
  const toDate = format(addDays(weekStart, 6), 'yyyy-MM-dd')

  const { data: employees = [] } = useStaffEmployees(user?.id)
  const { data: shifts = [] } = useStaffShifts(user?.id, fromDate, toDate)

  if (!user) return null

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <h1 className="text-lg font-semibold text-gray-800 mb-4">График сотрудников</h1>

      <StaffEmployeeListPanel ownerId={user.id} employees={employees} />

      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setWeekStart(w => subWeeks(w, 1))}
          className="p-2 text-gray-500 hover:text-gray-800"
          aria-label="Предыдущая неделя"
        >
          <CaretLeft size={18} />
        </button>
        <span className="text-sm font-medium text-gray-700">
          {format(weekStart, 'd MMM', { locale: ru })} – {format(addDays(weekStart, 6), 'd MMM yyyy', { locale: ru })}
        </span>
        <button
          onClick={() => setWeekStart(w => addWeeks(w, 1))}
          className="p-2 text-gray-500 hover:text-gray-800"
          aria-label="Следующая неделя"
        >
          <CaretRight size={18} />
        </button>
      </div>

      <StaffScheduleGrid ownerId={user.id} employees={employees} shifts={shifts} days={days} />
    </div>
  )
}
