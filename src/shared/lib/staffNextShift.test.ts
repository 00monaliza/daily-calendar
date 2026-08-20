import { describe, expect, it } from 'vitest'
import { findNextShift } from './staffNextShift'

describe('findNextShift', () => {
  it('returns null for an empty list', () => {
    expect(findNextShift([], '2026-08-20')).toBeNull()
  })

  it('picks the earliest upcoming work shift', () => {
    const shifts = [
      { date: '2026-08-25', status: 'work' as const, start_time: '08:00', end_time: '17:00' },
      { date: '2026-08-21', status: 'work' as const, start_time: '09:00', end_time: '18:00' },
    ]
    expect(findNextShift(shifts, '2026-08-20')).toEqual(shifts[1])
  })

  it('includes a shift scheduled for today', () => {
    const shifts = [{ date: '2026-08-20', status: 'work' as const, start_time: '08:00', end_time: '17:00' }]
    expect(findNextShift(shifts, '2026-08-20')).toEqual(shifts[0])
  })

  it('ignores past shifts', () => {
    const shifts = [{ date: '2026-08-19', status: 'work' as const, start_time: '08:00', end_time: '17:00' }]
    expect(findNextShift(shifts, '2026-08-20')).toBeNull()
  })

  it('ignores non-work statuses', () => {
    const shifts = [
      { date: '2026-08-21', status: 'day_off' as const, start_time: null, end_time: null },
      { date: '2026-08-22', status: 'vacation' as const, start_time: null, end_time: null },
    ]
    expect(findNextShift(shifts, '2026-08-20')).toBeNull()
  })
})
