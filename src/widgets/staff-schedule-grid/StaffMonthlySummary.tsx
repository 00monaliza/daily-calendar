import { useState } from 'react'
import { addMonths, endOfMonth, format, startOfMonth, subMonths } from 'date-fns'
import { ru } from 'date-fns/locale'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { useStaffShifts } from '@/entities/staff-shift/queries'
import { buildMonthlyWorkedDaysSummary } from '@/shared/lib/staffMonthlySummary'
import type { StaffEmployee } from '@/entities/staff-employee/types'

interface Props {
  ownerId: string
  employees: StaffEmployee[]
}

export function StaffMonthlySummary({ ownerId, employees }: Props) {
  const [monthStart, setMonthStart] = useState(() => startOfMonth(new Date()))

  const fromDate = format(monthStart, 'yyyy-MM-dd')
  const toDate = format(endOfMonth(monthStart), 'yyyy-MM-dd')
  const { data: shifts = [] } = useStaffShifts(ownerId, fromDate, toDate)

  const summary = buildMonthlyWorkedDaysSummary(employees, shifts)

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-800">Сводка за месяц</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMonthStart(m => subMonths(m, 1))}
            className="p-1 text-gray-500 hover:text-gray-800"
            aria-label="Предыдущий месяц"
          >
            <CaretLeft size={16} />
          </button>
          <span className="text-xs font-medium text-gray-700 w-24 text-center capitalize">
            {format(monthStart, 'LLLL yyyy', { locale: ru })}
          </span>
          <button
            onClick={() => setMonthStart(m => addMonths(m, 1))}
            className="p-1 text-gray-500 hover:text-gray-800"
            aria-label="Следующий месяц"
          >
            <CaretRight size={16} />
          </button>
        </div>
      </div>

      {summary.length === 0 ? (
        <div className="px-3 py-6 text-center text-sm text-gray-400">Пока нет сотрудников</div>
      ) : (
        summary.map(row => (
          <div
            key={row.employeeId}
            className="flex items-center justify-between border-b border-gray-100 last:border-0 px-3 py-2.5"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-800 truncate">{row.fullName}</div>
              {row.position && <div className="text-xs text-gray-500 truncate">{row.position}</div>}
            </div>
            <div className="text-right flex-shrink-0 pl-3">
              <div className="text-sm font-bold text-[#376E6F] tabular-nums">{row.workedDays}</div>
              <div className="text-[10px] text-gray-500">дней</div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
