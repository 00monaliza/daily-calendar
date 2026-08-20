import { format } from 'date-fns'

export interface CsvEmployee {
  id: string
  full_name: string
  position: string | null
}

export interface CsvShift {
  employee_id: string
  date: string
  status: 'work' | 'day_off' | 'vacation' | 'sick'
  start_time: string | null
  end_time: string | null
}

const STATUS_LABEL: Record<CsvShift['status'], string> = {
  work: '',
  day_off: 'OFF',
  vacation: 'VACATION',
  sick: 'SICK',
}

function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/** Builds a CSV matching the visible manager grid, for the owner to export a week's schedule. */
export function buildStaffScheduleCsv(employees: CsvEmployee[], shifts: CsvShift[], days: Date[]): string {
  const shiftsByKey = new Map<string, CsvShift>()
  for (const shift of shifts) {
    shiftsByKey.set(`${shift.employee_id}_${shift.date}`, shift)
  }

  const dayStrings = days.map(d => format(d, 'yyyy-MM-dd'))
  const header = ['Сотрудник', 'Должность', ...days.map(d => format(d, 'dd.MM.yyyy')), 'Дни']

  const rows = employees.map(employee => {
    let workedDays = 0
    const dayCells = dayStrings.map(dateStr => {
      const shift = shiftsByKey.get(`${employee.id}_${dateStr}`)
      if (!shift) return ''
      if (shift.status === 'work') {
        workedDays += 1
        return `${shift.start_time?.slice(0, 5) ?? ''}-${shift.end_time?.slice(0, 5) ?? ''}`
      }
      return STATUS_LABEL[shift.status]
    })
    return [employee.full_name, employee.position ?? '', ...dayCells, String(workedDays)]
  })

  return [header, ...rows].map(row => row.map(escapeCsvValue).join(',')).join('\r\n')
}
