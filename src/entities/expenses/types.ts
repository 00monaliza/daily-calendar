export type ExpenseCategory = 'cleaning' | 'repair' | 'furniture' | 'utilities' | 'other'

export interface Expense {
  id: string
  property_id: string | null
  owner_id: string
  amount: number
  category: ExpenseCategory
  description: string | null
  date: string
  created_at: string
}

export type ExpenseInsert = Omit<Expense, 'id' | 'owner_id' | 'created_at'>
