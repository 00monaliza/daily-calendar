import { describe, expect, it } from 'vitest'
import { buildMonthlyWorkedDaysSummary } from './staffMonthlySummary'

describe('buildMonthlyWorkedDaysSummary', () => {
  it('counts only work-status shifts per employee', () => {
    const employees = [
      { id: 'e1', full_name: 'Makpal', position: 'Горничная' },
      { id: 'e2', full_name: 'Aida', position: null },
    ]
    const shifts = [
      { employee_id: 'e1', status: 'work' as const },
      { employee_id: 'e1', status: 'work' as const },
      { employee_id: 'e1', status: 'day_off' as const },
      { employee_id: 'e2', status: 'work' as const },
      { employee_id: 'e2', status: 'sick' as const },
      { employee_id: 'e2', status: 'vacation' as const },
    ]

    const summary = buildMonthlyWorkedDaysSummary(employees, shifts)

    expect(summary).toEqual([
      { employeeId: 'e1', fullName: 'Makpal', position: 'Горничная', workedDays: 2 },
      { employeeId: 'e2', fullName: 'Aida', position: null, workedDays: 1 },
    ])
  })

  it('returns 0 for an employee with no shifts in the range', () => {
    const employees = [{ id: 'e1', full_name: 'Makpal', position: null }]
    const summary = buildMonthlyWorkedDaysSummary(employees, [])
    expect(summary).toEqual([{ employeeId: 'e1', fullName: 'Makpal', position: null, workedDays: 0 }])
  })

  it('ignores shifts for employees not in the list', () => {
    const employees = [{ id: 'e1', full_name: 'Makpal', position: null }]
    const shifts = [{ employee_id: 'stranger', status: 'work' as const }]
    const summary = buildMonthlyWorkedDaysSummary(employees, shifts)
    expect(summary).toEqual([{ employeeId: 'e1', fullName: 'Makpal', position: null, workedDays: 0 }])
  })

  it('preserves the given employee order', () => {
    const employees = [
      { id: 'e2', full_name: 'Bek', position: null },
      { id: 'e1', full_name: 'Aida', position: null },
    ]
    const summary = buildMonthlyWorkedDaysSummary(employees, [])
    expect(summary.map(r => r.employeeId)).toEqual(['e2', 'e1'])
  })
})
