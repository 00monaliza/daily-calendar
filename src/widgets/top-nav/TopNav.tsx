import { NavLink } from 'react-router-dom'
import { UserMenu } from '@/widgets/user-menu/UserMenu'

const navLinks = [
  { to: '/', end: true, label: 'Шахматка' },
  { to: '/properties', end: false, label: 'Квартиры' },
  { to: '/finances', end: false, label: 'Финансы' },
  { to: '/guests', end: false, label: 'Гости' },
]

export function TopNav() {
  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-6">
        <span className="font-bold text-[#376E6F] text-lg flex-shrink-0">Pogostim</span>

        {/* Desktop navigation */}
        <div className="hidden md:flex gap-1">
          {navLinks.map(({ to, end, label }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive ? 'bg-[#376E6F] text-white' : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>
      </div>

      <UserMenu />
    </nav>
  )
}
