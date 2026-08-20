interface Props {
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
}

export function PinInput({ value, onChange, autoFocus }: Props) {
  return (
    <input
      type="password"
      inputMode="numeric"
      pattern="[0-9]*"
      autoFocus={autoFocus}
      value={value}
      onChange={e => onChange(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
      placeholder="••••••"
      className="w-full border border-gray-300 rounded-lg px-3 py-3 text-center text-lg tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-[#376E6F]"
    />
  )
}
