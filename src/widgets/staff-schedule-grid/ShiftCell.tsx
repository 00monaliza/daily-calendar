import { contrastTextColor, hexToRgb } from '@/shared/lib/colorContrast'
import { SHIFT_STATUS_COLORS } from '@/shared/lib/shiftStatusColors'
import type { StaffShift } from '@/entities/staff-shift/types'

const STATUS_LABEL: Record<StaffShift['status'], string> = {
  work: '',
  day_off: 'OFF',
  vacation: 'VACATION',
  sick: 'SICK',
}

interface Props {
  shift: StaffShift | undefined
  onClick: () => void
}

export function ShiftCell({ shift, onClick }: Props) {
  const status = shift?.status ?? null

  if (!status) {
    return (
      <button
        onClick={onClick}
        className="w-full h-full min-h-[52px] flex items-center justify-center text-gray-300 hover:bg-gray-50 transition-colors text-xs"
      >
        +
      </button>
    )
  }

  const colors = SHIFT_STATUS_COLORS[status]
  const { r, g, b } = hexToRgb(colors.bg)
  const textColor = contrastTextColor(r, g, b)

  return (
    <button
      onClick={onClick}
      className="w-full h-full min-h-[52px] flex flex-col items-center justify-center gap-0.5 px-1 transition-opacity hover:opacity-80"
      style={{ backgroundColor: colors.bg, color: textColor, borderTop: `2px solid ${colors.border}` }}
    >
      {status === 'work' ? (
        <span className="text-[11px] tabular-nums font-medium">
          {shift?.start_time?.slice(0, 5)}–{shift?.end_time?.slice(0, 5)}
        </span>
      ) : (
        <span className="text-[10px] font-semibold tracking-wide">{STATUS_LABEL[status]}</span>
      )}
    </button>
  )
}
