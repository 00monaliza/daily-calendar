import { useState } from 'react'
import { addDays, addWeeks, eachDayOfInterval, endOfWeek, format, startOfWeek, subWeeks } from 'date-fns'
import { ru } from 'date-fns/locale'
import { CaretLeft, CaretRight, DownloadSimple } from '@phosphor-icons/react'
import { useUser } from '@/features/auth/useUser'
import { useStaffEmployees } from '@/entities/staff-employee/queries'
import { useStaffShifts } from '@/entities/staff-shift/queries'
import { StaffEmployeeListPanel } from '@/widgets/staff-schedule-grid/StaffEmployeeListPanel'
import { StaffScheduleGrid } from '@/widgets/staff-schedule-grid/StaffScheduleGrid'
import { StaffMonthlySummary } from '@/widgets/staff-schedule-grid/StaffMonthlySummary'
import { buildStaffScheduleWorkbook } from '@/shared/lib/staffScheduleXlsx'

export function StaffSchedulePage() {
  const { user } = useUser()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [exporting, setExporting] = useState(false)

  const days = eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) })
  const fromDate = format(weekStart, 'yyyy-MM-dd')
  const toDate = format(addDays(weekStart, 6), 'yyyy-MM-dd')

  const { data: employees = [] } = useStaffEmployees(user?.id)
  const { data: shifts = [] } = useStaffShifts(user?.id, fromDate, toDate)

  if (!user) return null

  async function handleExport() {
    setExporting(true)
    try {
      const workbook = buildStaffScheduleWorkbook(employees, shifts, days)
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `staff-schedule-${fromDate}-${toDate}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-800">График сотрудников</h1>
        <button
          onClick={handleExport}
          disabled={employees.length === 0 || exporting}
          className="flex items-center gap-1.5 text-sm font-medium text-[#376E6F] hover:underline disabled:opacity-40 disabled:no-underline"
        >
          <DownloadSimple size={16} />
          {exporting ? 'Формирование...' : 'Экспорт в таблицу'}
        </button>
      </div>

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

      <div className="mt-6">
        <StaffMonthlySummary ownerId={user.id} employees={employees} />
      </div>
    </div>
  )
}
