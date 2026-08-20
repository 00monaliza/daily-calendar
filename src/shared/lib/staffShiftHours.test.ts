import { describe, expect, it } from 'vitest'
import { computeShiftHours, sumShiftHours } from './staffShiftHours'

describe('computeShiftHours', () => {
  it('computes a same-day shift', () => {
    expect(computeShiftHours({ status: 'work', start_time: '08:00', end_time: '17:00' })).toBe(9)
  })

  it('computes an overnight shift that crosses midnight', () => {
    expect(computeShiftHours({ status: 'work', start_time: '21:00', end_time: '09:00' })).toBe(12)
  })

  it('accepts HH:MM:SS as returned by Postgres time columns', () => {
    expect(computeShiftHours({ status: 'work', start_time: '08:00:00', end_time: '20:00:00' })).toBe(12)
  })

  it('treats identical start and end as a full 24-hour shift', () => {
    expect(computeShiftHours({ status: 'work', start_time: '08:00', end_time: '08:00' })).toBe(24)
  })

  it('returns 0 for a day off', () => {
    expect(computeShiftHours({ status: 'day_off', start_time: null, end_time: null })).toBe(0)
  })

  it('returns 0 for vacation', () => {
    expect(computeShiftHours({ status: 'vacation', start_time: null, end_time: null })).toBe(0)
  })

  it('returns 0 for sick', () => {
    expect(computeShiftHours({ status: 'sick', start_time: null, end_time: null })).toBe(0)
  })

  it('returns 0 for a work status missing times (defensive)', () => {
    expect(computeShiftHours({ status: 'work', start_time: null, end_time: null })).toBe(0)
  })
})

describe('sumShiftHours', () => {
  it('sums hours across a week of shifts', () => {
    const shifts = [
      { status: 'work' as const, start_time: '08:00', end_time: '17:00' }, // 9
      { status: 'work' as const, start_time: '08:00', end_time: '17:00' }, // 9
      { status: 'day_off' as const, start_time: null, end_time: null }, // 0
      { status: 'work' as const, start_time: '21:00', end_time: '09:00' }, // 12
    ]
    expect(sumShiftHours(shifts)).toBe(30)
  })

  it('returns 0 for an empty list', () => {
    expect(sumShiftHours([])).toBe(0)
  })
})
