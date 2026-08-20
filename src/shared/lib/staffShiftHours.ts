/**
 * Shape needed to compute a shift's duration. Intentionally standalone
 * (not imported from entities/staff-shift) — shared/lib must not depend
 * on the entities layer. entities/staff-shift/types.ts declares its own
 * StaffShiftStatus with the same literal values.
 */
export interface ShiftHoursInput {
  status: 'work' | 'day_off' | 'vacation' | 'sick'
  start_time: string | null
  end_time: string | null
}

function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/**
 * Returns hours worked for one shift. Non-'work' statuses and missing
 * times always return 0. An overnight shift (end <= start, e.g.
 * 21:00 -> 09:00) is assumed to cross midnight and wraps by adding 24h;
 * this also means an identical start/end resolves to a full 24h shift
 * rather than 0 — intentional, see the test for this case.
 */
export function computeShiftHours(shift: ShiftHoursInput): number {
  if (shift.status !== 'work') return 0
  if (!shift.start_time || !shift.end_time) return 0

  const startMinutes = parseTimeToMinutes(shift.start_time)
  const endMinutes = parseTimeToMinutes(shift.end_time)
  let diffMinutes = endMinutes - startMinutes
  if (diffMinutes <= 0) diffMinutes += 24 * 60

  return Math.round((diffMinutes / 60) * 100) / 100
}

export function sumShiftHours(shifts: ShiftHoursInput[]): number {
  const total = shifts.reduce((sum, shift) => sum + computeShiftHours(shift), 0)
  return Math.round(total * 100) / 100
}
