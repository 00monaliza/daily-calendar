export interface SummaryEmployee {
  id: string
  full_name: string
  position: string | null
}

export interface SummaryShift {
  employee_id: string
  status: 'work' | 'day_off' | 'vacation' | 'sick'
}

export interface MonthlySummaryRow {
  employeeId: string
  fullName: string
  position: string | null
  workedDays: number
}

/** Total work-status days per employee within the given (already date-filtered) shifts. */
export function buildMonthlyWorkedDaysSummary(
  employees: SummaryEmployee[],
  shifts: SummaryShift[]
): MonthlySummaryRow[] {
  const workedDaysByEmployee = new Map<string, number>()
  for (const shift of shifts) {
    if (shift.status !== 'work') continue
    workedDaysByEmployee.set(shift.employee_id, (workedDaysByEmployee.get(shift.employee_id) ?? 0) + 1)
  }

  return employees.map(employee => ({
    employeeId: employee.id,
    fullName: employee.full_name,
    position: employee.position,
    workedDays: workedDaysByEmployee.get(employee.id) ?? 0,
  }))
}
