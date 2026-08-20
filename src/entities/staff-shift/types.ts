export type StaffShiftStatus = 'work' | 'day_off' | 'vacation' | 'sick'

export interface StaffShift {
  id: string
  owner_id: string
  employee_id: string
  auth_user_id: string | null
  date: string
  start_time: string | null
  end_time: string | null
  status: StaffShiftStatus
  note: string | null
  created_at: string
  updated_at: string
}

export interface StaffShiftUpsert {
  owner_id: string
  employee_id: string
  auth_user_id?: string | null
  date: string
  status: StaffShiftStatus
  start_time?: string | null
  end_time?: string | null
  note?: string | null
}
