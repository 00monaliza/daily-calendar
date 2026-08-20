export interface StaffEmployee {
  id: string
  owner_id: string
  full_name: string
  position: string | null
  login: string
  auth_user_id: string | null
  is_active: boolean
  sort_order: number | null
  created_at: string
}

export interface StaffEmployeeInsert {
  owner_id: string
  full_name: string
  position?: string | null
  login: string
}

export type StaffEmployeeUpdate = Partial<
  Pick<StaffEmployee, 'full_name' | 'position' | 'is_active' | 'sort_order'>
>
