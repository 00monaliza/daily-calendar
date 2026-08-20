import { describe, expect, it } from 'vitest'
import { buildStaffScheduleCsv } from './staffScheduleCsv'

const days = [new Date(2026, 7, 17), new Date(2026, 7, 18), new Date(2026, 7, 19)]

describe('buildStaffScheduleCsv', () => {
  it('builds a header row with dates and a Дни column', () => {
    const csv = buildStaffScheduleCsv([], [], days)
    const [header] = csv.split('\r\n')
    expect(header).toBe('Сотрудник,Должность,17.08.2026,18.08.2026,19.08.2026,Дни')
  })

  it('renders a work shift as a time range and counts it toward worked days', () => {
    const employees = [{ id: 'e1', full_name: 'Makpal', position: 'Горничная' }]
    const shifts = [
      { employee_id: 'e1', date: '2026-08-17', status: 'work' as const, start_time: '08:00', end_time: '17:00' },
    ]
    const csv = buildStaffScheduleCsv(employees, shifts, days)
    const [, row] = csv.split('\r\n')
    expect(row).toBe('Makpal,Горничная,08:00-17:00,,,1')
  })

  it('renders non-work statuses as short labels without counting toward worked days', () => {
    const employees = [{ id: 'e1', full_name: 'Makpal', position: null }]
    const shifts = [
      { employee_id: 'e1', date: '2026-08-17', status: 'day_off' as const, start_time: null, end_time: null },
      { employee_id: 'e1', date: '2026-08-18', status: 'vacation' as const, start_time: null, end_time: null },
      { employee_id: 'e1', date: '2026-08-19', status: 'sick' as const, start_time: null, end_time: null },
    ]
    const csv = buildStaffScheduleCsv(employees, shifts, days)
    const [, row] = csv.split('\r\n')
    expect(row).toBe('Makpal,,OFF,VACATION,SICK,0')
  })

  it('quotes fields that contain commas', () => {
    const employees = [{ id: 'e1', full_name: 'Test, A', position: null }]
    const csv = buildStaffScheduleCsv(employees, [], days)
    const [, row] = csv.split('\r\n')
    expect(row).toBe('"Test, A",,,,,0')
  })
})
