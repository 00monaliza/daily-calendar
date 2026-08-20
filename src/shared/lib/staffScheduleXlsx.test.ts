import { describe, expect, it } from 'vitest'
import { buildStaffScheduleWorkbook } from './staffScheduleXlsx'

const days = [new Date(2026, 7, 17), new Date(2026, 7, 18), new Date(2026, 7, 19)]

describe('buildStaffScheduleWorkbook', () => {
  it('writes a header row with dates and a Дни column', () => {
    const workbook = buildStaffScheduleWorkbook([], [], days)
    const sheet = workbook.getWorksheet('График')!
    const header = sheet.getRow(1).values as unknown[]
    expect(header.slice(1)).toEqual(['Сотрудник', 'Должность', '17.08.2026', '18.08.2026', '19.08.2026', 'Дни'])
  })

  it('fills a work-shift cell with the orange work color and shows the time range', () => {
    const employees = [{ id: 'e1', full_name: 'Makpal', position: 'Горничная' }]
    const shifts = [
      { employee_id: 'e1', date: '2026-08-17', status: 'work' as const, start_time: '08:00', end_time: '17:00' },
    ]
    const workbook = buildStaffScheduleWorkbook(employees, shifts, days)
    const sheet = workbook.getWorksheet('График')!
    const row = sheet.getRow(2)

    expect(row.getCell(3).value).toBe('08:00-17:00')
    expect(row.getCell(3).fill).toMatchObject({ fgColor: { argb: 'FFFFF1E0' } })
    expect(row.getCell(6).value).toBe(1) // Дни column
  })

  it('fills day_off/vacation/sick cells with their respective colors', () => {
    const employees = [{ id: 'e1', full_name: 'Makpal', position: null }]
    const shifts = [
      { employee_id: 'e1', date: '2026-08-17', status: 'day_off' as const, start_time: null, end_time: null },
      { employee_id: 'e1', date: '2026-08-18', status: 'vacation' as const, start_time: null, end_time: null },
      { employee_id: 'e1', date: '2026-08-19', status: 'sick' as const, start_time: null, end_time: null },
    ]
    const workbook = buildStaffScheduleWorkbook(employees, shifts, days)
    const sheet = workbook.getWorksheet('График')!
    const row = sheet.getRow(2)

    expect(row.getCell(3).value).toBe('OFF')
    expect(row.getCell(3).fill).toMatchObject({ fgColor: { argb: 'FFE8F5E9' } })

    expect(row.getCell(4).value).toBe('VACATION')
    expect(row.getCell(4).fill).toMatchObject({ fgColor: { argb: 'FFE3F2FD' } })

    expect(row.getCell(5).value).toBe('SICK')
    expect(row.getCell(5).fill).toMatchObject({ fgColor: { argb: 'FFFEF2F2' } })

    expect(row.getCell(6).value).toBe(0)
  })
})
