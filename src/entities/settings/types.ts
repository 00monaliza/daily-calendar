export interface UserSettings {
  user_id: string
  date_format: 'DD.MM.YYYY' | 'MM.DD.YYYY'
  week_start: 'monday' | 'sunday'
  timezone: string
  show_full_text: boolean
  compact_mode: boolean
  booking_sources: string[]
}

export type SettingsPatch = Partial<Omit<UserSettings, 'user_id'>>

export const DEFAULT_SETTINGS: Omit<UserSettings, 'user_id'> = {
  date_format: 'DD.MM.YYYY',
  week_start: 'monday',
  timezone: 'Asia/Almaty',
  show_full_text: true,
  compact_mode: false,
  booking_sources: ['direct', 'kaspi', 'booking', 'airbnb', 'avito', 'cash', 'other'],
}
