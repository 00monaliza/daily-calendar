// src/widgets/bottom-nav/BottomNav.tsx
import { NavLink } from 'react-router-dom'

interface Props {
  onAddBooking: () => void
}

const tabs = [
  { to: '/', end: true, icon: GridIcon, label: 'Шахматка' },
  { to: '/properties', end: false, icon: BuildingIcon, label: 'Квартиры' },
  { to: '/finances', end: false, icon: ChartIcon, label: 'Финансы' },
  { to: '/guests', end: false, icon: PersonIcon, label: 'Гости' },
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
                <Icon active={isActive} />
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

// ── Icons ──────────────────────────────────────────────────────────────────

function GridIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function BuildingIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 21V9h6v12" />
      <path d="M9 9h6" />
    </svg>
  )
}

function ChartIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

function PersonIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 1.8}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  )
}
