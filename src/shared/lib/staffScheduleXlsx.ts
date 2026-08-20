import ExcelJS from 'exceljs'
import { format } from 'date-fns'
import { SHIFT_STATUS_COLORS } from './shiftStatusColors'

export interface XlsxEmployee {
  id: string
  full_name: string
  position: string | null
}

export interface XlsxShift {
  employee_id: string
  date: string
  status: 'work' | 'day_off' | 'vacation' | 'sick'
  start_time: string | null
  end_time: string | null
}

const STATUS_LABEL: Record<XlsxShift['status'], string> = {
  work: '',
  day_off: 'OFF',
  vacation: 'VACATION',
  sick: 'SICK',
}

function hexToArgb(hex: string): string {
  return `FF${hex.replace('#', '').toUpperCase()}`
}

/** Builds a colored Excel workbook matching the visible manager grid, for export. */
export function buildStaffScheduleWorkbook(
  employees: XlsxEmployee[],
  shifts: XlsxShift[],
  days: Date[]
): ExcelJS.Workbook {
  const shiftsByKey = new Map<string, XlsxShift>()
  for (const shift of shifts) {
    shiftsByKey.set(`${shift.employee_id}_${shift.date}`, shift)
  }
  const dayStrings = days.map(d => format(d, 'yyyy-MM-dd'))

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('График')

  const headerRow = sheet.addRow(['Сотрудник', 'Должность', ...days.map(d => format(d, 'dd.MM.yyyy')), 'Дни'])
  headerRow.font = { bold: true }
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
  })

  for (const employee of employees) {
    let workedDays = 0
    const row = sheet.addRow([employee.full_name, employee.position ?? ''])

    dayStrings.forEach((dateStr, i) => {
      const cell = row.getCell(3 + i)
      const shift = shiftsByKey.get(`${employee.id}_${dateStr}`)
      if (!shift) return

      const colors = SHIFT_STATUS_COLORS[shift.status]
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(colors.bg) } }
      cell.font = { color: { argb: hexToArgb(colors.text) } }

      if (shift.status === 'work') {
        workedDays += 1
        cell.value = `${shift.start_time?.slice(0, 5) ?? ''}-${shift.end_time?.slice(0, 5) ?? ''}`
      } else {
        cell.value = STATUS_LABEL[shift.status]
      }
    })

    row.getCell(3 + dayStrings.length).value = workedDays
  }

  sheet.columns.forEach((col, i) => {
    col.width = i < 2 ? 18 : 12
  })

  return workbook
}
