// Pure availability helpers shared by the voice-booking Edge Function (Deno)
// and the web app (re-exported from src/shared/lib/bookingAvailability.ts).
// No imports on purpose: this file must run unchanged in both runtimes.
//
// Dates are ISO 'YYYY-MM-DD' strings. A stay occupies the nights
// [check_in, check_out), so a guest checking out on the 15th does not clash
// with another checking in on the 15th.

export interface BusyRange {
  id?: string
  property_id: string
  check_in: string
  check_out: string
  guest_name?: string | null
}

export interface DateRange {
  check_in: string
  check_out: string
  nights: number
}

export interface PropertyRef {
  id: string
  name: string
}

export interface AvailabilityReport {
  status: 'free' | 'busy' | 'unknown'
  conflicts: { guest_name: string | null; check_in: string; check_out: string }[]
  /** Free gaps for the chosen property inside the search window. */
  free_windows: DateRange[]
  /** Same-length stays near the requested dates when they are busy. */
  alternatives: DateRange[]
  /** Other properties free on exactly the requested dates. */
  free_properties: PropertyRef[]
  window: { from: string; to: string }
}

const DAY_MS = 86_400_000

function toUtc(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function addDaysIso(date: string, days: number): string {
  return new Date(toUtc(date) + days * DAY_MS).toISOString().slice(0, 10)
}

export function diffDaysIso(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS)
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  return addDaysIso(value, 0) === value
}

export function rangesOverlap(aIn: string, aOut: string, bIn: string, bOut: string): boolean {
  return aIn < bOut && bIn < aOut
}

export function findConflicts<T extends BusyRange>(
  bookings: T[],
  propertyId: string,
  checkIn: string,
  checkOut: string,
  excludeBookingId?: string | null,
): T[] {
  return bookings
    .filter(b => b.property_id === propertyId && b.id !== excludeBookingId)
    .filter(b => rangesOverlap(b.check_in, b.check_out, checkIn, checkOut))
    .sort((a, b) => a.check_in.localeCompare(b.check_in))
}

/** Gaps of at least `minNights` between the property's stays, clipped to [from, to). */
export function findFreeWindows(
  bookings: BusyRange[],
  propertyId: string,
  from: string,
  to: string,
  minNights = 1,
  excludeBookingId?: string | null,
): DateRange[] {
  const busy = bookings
    .filter(b => b.property_id === propertyId && b.id !== excludeBookingId)
    .filter(b => rangesOverlap(b.check_in, b.check_out, from, to))
    .sort((a, b) => a.check_in.localeCompare(b.check_in))

  const windows: DateRange[] = []
  let cursor = from
  for (const b of busy) {
    if (b.check_in > cursor) pushWindow(windows, cursor, b.check_in < to ? b.check_in : to, minNights)
    if (b.check_out > cursor) cursor = b.check_out
    if (cursor >= to) break
  }
  if (cursor < to) pushWindow(windows, cursor, to, minNights)
  return windows
}

function pushWindow(windows: DateRange[], start: string, end: string, minNights: number) {
  const nights = diffDaysIso(start, end)
  if (nights >= minNights) windows.push({ check_in: start, check_out: end, nights })
}

/** Up to `limit` same-length stays closest to the requested check-in. */
export function suggestAlternatives(
  bookings: BusyRange[],
  propertyId: string,
  checkIn: string,
  checkOut: string,
  searchDays = 30,
  limit = 3,
  excludeBookingId?: string | null,
  notBefore?: string | null,
): DateRange[] {
  const nights = diffDaysIso(checkIn, checkOut)
  if (nights <= 0) return []
  const earliest = addDaysIso(checkIn, -searchDays)
  const from = notBefore ? maxIso(earliest, notBefore) : earliest
  const to = addDaysIso(checkOut, searchDays)
  const candidates: { range: DateRange; distance: number }[] = []

  for (const w of findFreeWindows(bookings, propertyId, from, to, nights, excludeBookingId)) {
    const latestStart = addDaysIso(w.check_out, -nights)
    // Closest start to the requested one that still fits inside the gap.
    let start = checkIn
    if (start < w.check_in) start = w.check_in
    if (start > latestStart) start = latestStart
    candidates.push({
      range: { check_in: start, check_out: addDaysIso(start, nights), nights },
      distance: Math.abs(diffDaysIso(checkIn, start)),
    })
  }

  return candidates
    .filter(c => c.distance > 0)
    .sort((a, b) => a.distance - b.distance || a.range.check_in.localeCompare(b.range.check_in))
    .slice(0, limit)
    .map(c => c.range)
}

function maxIso(a: string, b: string): string {
  return a > b ? a : b
}

export function findFreeProperties<P extends PropertyRef>(
  properties: P[],
  bookings: BusyRange[],
  checkIn: string,
  checkOut: string,
  excludePropertyId?: string | null,
  excludeBookingId?: string | null,
): P[] {
  return properties.filter(
    p => p.id !== excludePropertyId && findConflicts(bookings, p.id, checkIn, checkOut, excludeBookingId).length === 0,
  )
}

/**
 * Everything the confirmation screen needs in one place.
 * Without dates it lists free windows from `today` for the next `searchDays`.
 */
export function buildAvailabilityReport(params: {
  bookings: BusyRange[]
  properties: PropertyRef[]
  propertyId: string | null
  checkIn: string | null
  checkOut: string | null
  today: string
  searchDays?: number
  excludeBookingId?: string | null
}): AvailabilityReport {
  const { bookings, properties, propertyId, checkIn, checkOut, today, excludeBookingId } = params
  const searchDays = params.searchDays ?? 30
  const hasDates = isIsoDate(checkIn) && isIsoDate(checkOut) && checkIn < checkOut

  const window = hasDates
    ? { from: maxIso(addDaysIso(checkIn!, -searchDays), today), to: addDaysIso(checkOut!, searchDays) }
    : { from: today, to: addDaysIso(today, searchDays * 2) }

  const report: AvailabilityReport = {
    status: 'unknown',
    conflicts: [],
    free_windows: [],
    alternatives: [],
    free_properties: [],
    window,
  }

  if (hasDates) {
    report.free_properties = findFreeProperties(properties, bookings, checkIn!, checkOut!, propertyId, excludeBookingId)
      .map(p => ({ id: p.id, name: p.name }))
  }

  if (!propertyId) return report

  report.free_windows = findFreeWindows(bookings, propertyId, window.from, window.to, 1, excludeBookingId)

  if (!hasDates) return report

  const conflicts = findConflicts(bookings, propertyId, checkIn!, checkOut!, excludeBookingId)
  report.status = conflicts.length > 0 ? 'busy' : 'free'
  report.conflicts = conflicts.map(c => ({ guest_name: c.guest_name ?? null, check_in: c.check_in, check_out: c.check_out }))
  if (conflicts.length > 0) {
    report.alternatives = suggestAlternatives(bookings, propertyId, checkIn!, checkOut!, searchDays, 3, excludeBookingId, today)
  }
  return report
}
