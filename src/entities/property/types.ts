export interface Property {
  id: string
  owner_id: string
  name: string
  address: string | null
  rooms: number
  base_price: number
  description: string | null
  color: string
  is_active: boolean
  sort_order: number | null
  /** Short spoken names used by voice booking ("инжу 12", "весна"). Added in migration 007. */
  voice_aliases?: string[]
  created_at: string
}

export type PropertyInsert = Omit<Property, 'id' | 'created_at' | 'sort_order'> & {
  sort_order?: number | null
}
export type PropertyUpdate = Partial<PropertyInsert>
