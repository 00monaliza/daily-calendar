import { useState } from 'react'
import { Eye, EyeSlash } from '@phosphor-icons/react'

interface Props {
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
}

export function PinInput({ value, onChange, autoFocus }: Props) {
  const [visible, setVisible] = useState(true)

  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        inputMode="numeric"
        pattern="[0-9]*"
        autoFocus={autoFocus}
        value={value}
        onChange={e => onChange(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
        placeholder="••••••"
        className="w-full border border-gray-300 rounded-lg pl-3 pr-10 py-3 text-center text-lg tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-[#376E6F]"
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        aria-label={visible ? 'Скрыть PIN' : 'Показать PIN'}
      >
        {visible ? <EyeSlash size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}
