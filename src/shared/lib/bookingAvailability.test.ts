import { describe, expect, it } from 'vitest'
import {
  buildAvailabilityReport,
  findConflicts,
  findFreeWindows,
  isIsoDate,
  suggestAlternatives,
} from './bookingAvailability'

const P1 = 'p1'
const P2 = 'p2'
const bookings = [
  { id: 'b1', property_id: P1, check_in: '2026-11-10', check_out: '2026-11-13', guest_name: 'Айгерим' },
  { id: 'b2', property_id: P1, check_in: '2026-11-15', check_out: '2026-11-20', guest_name: 'Олжас' },
  { id: 'b3', property_id: P2, check_in: '2026-11-01', check_out: '2026-11-30', guest_name: 'Долгая' },
]

describe('isIsoDate', () => {
  it('accepts real dates and rejects impossible ones', () => {
    expect(isIsoDate('2026-02-28')).toBe(true)
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(isIsoDate('12.11.2026')).toBe(false)
    expect(isIsoDate(null)).toBe(false)
  })
})

describe('findConflicts', () => {
  it('allows same-day turnover', () => {
    expect(findConflicts(bookings, P1, '2026-11-13', '2026-11-15')).toEqual([])
  })

  it('finds overlapping stays on the same property only', () => {
    expect(findConflicts(bookings, P1, '2026-11-12', '2026-11-16').map(b => b.id)).toEqual(['b1', 'b2'])
  })

  it('ignores the booking being edited', () => {
    expect(findConflicts(bookings, P1, '2026-11-11', '2026-11-12', 'b1')).toEqual([])
  })
})

describe('findFreeWindows', () => {
  it('returns gaps between stays clipped to the window', () => {
    expect(findFreeWindows(bookings, P1, '2026-11-08', '2026-11-25')).toEqual([
      { check_in: '2026-11-08', check_out: '2026-11-10', nights: 2 },
      { check_in: '2026-11-13', check_out: '2026-11-15', nights: 2 },
      { check_in: '2026-11-20', check_out: '2026-11-25', nights: 5 },
    ])
  })

  it('skips gaps shorter than the minimum', () => {
    expect(findFreeWindows(bookings, P1, '2026-11-08', '2026-11-25', 3)).toEqual([
      { check_in: '2026-11-20', check_out: '2026-11-25', nights: 5 },
    ])
  })
})

describe('suggestAlternatives', () => {
  it('suggests the nearest same-length stays', () => {
    expect(suggestAlternatives(bookings, P1, '2026-11-12', '2026-11-14')).toEqual([
      { check_in: '2026-11-13', check_out: '2026-11-15', nights: 2 },
      { check_in: '2026-11-08', check_out: '2026-11-10', nights: 2 },
      { check_in: '2026-11-20', check_out: '2026-11-22', nights: 2 },
    ])
  })

  it('never suggests dates before notBefore', () => {
    const result = suggestAlternatives(bookings, P1, '2026-11-12', '2026-11-14', 30, 3, null, '2026-11-11')
    expect(result.length).toBeGreaterThan(0)
    expect(result.every(r => r.check_in >= '2026-11-11')).toBe(true)
  })
})

describe('buildAvailabilityReport', () => {
  const properties = [{ id: P1, name: 'Инжу Арена 12' }, { id: P2, name: 'Весна 3' }]

  it('reports busy dates with alternatives and other free properties', () => {
    const report = buildAvailabilityReport({
      bookings: bookings.filter(b => b.id !== 'b3'),
      properties,
      propertyId: P1,
      checkIn: '2026-11-11',
      checkOut: '2026-11-12',
      today: '2026-10-19',
    })
    expect(report.status).toBe('busy')
    expect(report.conflicts).toEqual([{ guest_name: 'Айгерим', check_in: '2026-11-10', check_out: '2026-11-13' }])
    expect(report.alternatives[0]).toEqual({ check_in: '2026-11-09', check_out: '2026-11-10', nights: 1 })
    expect(report.free_properties).toEqual([{ id: P2, name: 'Весна 3' }])
  })

  it('reports free dates', () => {
    const report = buildAvailabilityReport({
      bookings, properties, propertyId: P1, checkIn: '2026-11-13', checkOut: '2026-11-15', today: '2026-10-19',
    })
    expect(report.status).toBe('free')
    expect(report.alternatives).toEqual([])
  })

  it('lists free windows from today when dates are unknown', () => {
    const report = buildAvailabilityReport({
      bookings, properties, propertyId: P1, checkIn: null, checkOut: null, today: '2026-11-01',
    })
    expect(report.status).toBe('unknown')
    expect(report.window).toEqual({ from: '2026-11-01', to: '2026-12-31' })
    expect(report.free_windows[0]).toEqual({ check_in: '2026-11-01', check_out: '2026-11-10', nights: 9 })
  })
})
