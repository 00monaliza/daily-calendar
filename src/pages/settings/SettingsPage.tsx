import { useEffect, useRef, useState } from 'react'
import { useSettings, useUpdateSettings } from '@/entities/settings/queries'
import { Toggle } from '@/shared/ui/Toggle'
import type { SettingsPatch } from '@/entities/settings/types'
import { Check } from '@phosphor-icons/react'

const TIMEZONES = [
  { value: 'UTC', label: 'UTC (0:00)' },
  { value: 'Asia/Almaty', label: 'Алматы (UTC+5)' },
  { value: 'Asia/Tashkent', label: 'Ташкент (UTC+5)' },
  { value: 'Asia/Bishkek', label: 'Бишкек (UTC+6)' },
  { value: 'Asia/Tbilisi', label: 'Тбилиси (UTC+4)' },
  { value: 'Asia/Dubai', label: 'Дубай (UTC+4)' },
  { value: 'Europe/Moscow', label: 'Москва (UTC+3)' },
  { value: 'Europe/Kiev', label: 'Киев (UTC+2)' },
  { value: 'Europe/London', label: 'Лондон (UTC+0/+1)' },
  { value: 'America/New_York', label: 'Нью-Йорк (UTC-5/-4)' },
]

function SegmentedControl({
  value,
  options,
  onChange,
}: {
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div className="flex rounded-lg border border-gray-200 overflow-hidden">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 px-3 py-1.5 text-sm font-medium transition-colors ${
            value === opt.value
              ? 'bg-[#376E6F] text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function SavedIndicator({ show }: { show: boolean }) {
  return (
    <div
      className={`flex items-center gap-1 text-xs text-green-600 transition-opacity duration-300 ${
        show ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <Check size={12} weight="bold" />
      Сохранено
    </div>
  )
}

export function SettingsPage() {
  const { data: settings, isLoading } = useSettings()
  const updateSettings = useUpdateSettings()
  const [saved, setSaved] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Local state mirrors settings, updated optimistically
  const [local, setLocal] = useState<SettingsPatch>({})

  useEffect(() => {
    if (settings) {
      setLocal({
        date_format: settings.date_format,
        week_start: settings.week_start,
        timezone: settings.timezone,
        show_full_text: settings.show_full_text,
        compact_mode: settings.compact_mode,
      })
    }
  }, [settings])

  function update(patch: SettingsPatch) {
    const next = { ...local, ...patch }
    setLocal(next)
    setSaved(false)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      await updateSettings.mutateAsync(next)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }, 800)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-4 border-[#376E6F] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Настройки</h1>
        <SavedIndicator show={saved} />
      </div>

      {/* General settings */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <h2 className="text-base font-semibold text-gray-800">Общие</h2>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Часовой пояс</label>
          <select
            value={local.timezone ?? 'Asia/Almaty'}
            onChange={e => update({ timezone: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#376E6F] bg-white"
          >
            {TIMEZONES.map(tz => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Формат даты</label>
          <SegmentedControl
            value={local.date_format ?? 'DD.MM.YYYY'}
            options={[
              { value: 'DD.MM.YYYY', label: 'ДД.ММ.ГГГГ' },
              { value: 'MM.DD.YYYY', label: 'ММ.ДД.ГГГГ' },
            ]}
            onChange={v => update({ date_format: v as 'DD.MM.YYYY' | 'MM.DD.YYYY' })}
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Первый день недели</label>
          <SegmentedControl
            value={local.week_start ?? 'monday'}
            options={[
              { value: 'monday', label: 'Понедельник' },
              { value: 'sunday', label: 'Воскресенье' },
            ]}
            onChange={v => update({ week_start: v as 'monday' | 'sunday' })}
          />
        </div>
      </div>

      {/* Calendar settings */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <h2 className="text-base font-semibold text-gray-800">Календарь</h2>

        <Toggle
          checked={local.show_full_text ?? true}
          onChange={v => update({ show_full_text: v })}
          label="Показывать полный текст брони"
          description="Имя гостя и комментарий отображаются полностью без сокращений"
        />

        <div className="border-t border-gray-100" />

        <Toggle
          checked={local.compact_mode ?? false}
          onChange={v => update({ compact_mode: v })}
          label="Компактный режим"
          description="Уменьшенная высота строк в календаре"
        />
      </div>
    </div>
  )
}
