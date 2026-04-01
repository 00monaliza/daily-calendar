// src/widgets/bottom-nav/BottomNav.tsx
import { NavLink } from 'react-router-dom'
import { SquaresFour, Buildings, Pulse, User } from '@phosphor-icons/react'

interface Props {
  onAddBooking: () => void
}

type TabIcon = typeof SquaresFour

const tabs: { to: string; end: boolean; icon: TabIcon; label: string }[] = [
  { to: '/', end: true, icon: SquaresFour, label: 'Шахматка' },
  { to: '/properties', end: false, icon: Buildings, label: 'Квартиры' },
  { to: '/finances', end: false, icon: Pulse, label: 'Финансы' },
  { to: '/guests', end: false, icon: User, label: 'Гости' },
]

export function BottomNav({ onAddBooking }: Props) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch h-14 relative">
        {tabs.map(({ to, end, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors min-h-[44px] ${
                isActive ? 'text-[#376E6F]' : 'text-gray-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={22} weight={isActive ? 'fill' : 'regular'} />
                <span className="text-[10px] font-medium">{label}</span>
              </>
            )}
          </NavLink>
        ))}

        {/* FAB */}
        <button
          onClick={onAddBooking}
          className="absolute -top-5 right-4 w-12 h-12 bg-[#376E6F] text-white rounded-full shadow-lg flex items-center justify-center text-2xl hover:bg-[#1C3334] transition-colors active:scale-95"
          aria-label="Добавить бронь"
        >
          +
        </button>
      </div>
    </nav>
  )
}
