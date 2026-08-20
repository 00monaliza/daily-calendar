export interface ShiftForNextLookup {
  date: string
  status: 'work' | 'day_off' | 'vacation' | 'sick'
  start_time: string | null
  end_time: string | null
}

export function findNextShift(shifts: ShiftForNextLookup[], todayStr: string): ShiftForNextLookup | null {
  const upcoming = shifts
    .filter(s => s.status === 'work' && s.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
  return upcoming[0] ?? null
}
