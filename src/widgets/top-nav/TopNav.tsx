import { NavLink, useNavigate } from 'react-router-dom'
import { signOut } from '@/features/auth/useUser'

export function TopNav() {
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/auth')
  }

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <span className="font-bold text-[#376E6F] text-lg">Pogostim</span>
        <div className="flex gap-1">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-[#376E6F] text-white' : 'text-gray-600 hover:bg-gray-100'}`
            }
          >
            Шахматка
          </NavLink>
          <NavLink
            to="/properties"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-[#376E6F] text-white' : 'text-gray-600 hover:bg-gray-100'}`
            }
          >
            Квартиры
          </NavLink>
          <NavLink
            to="/finances"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-[#376E6F] text-white' : 'text-gray-600 hover:bg-gray-100'}`
            }
          >
            Финансы
          </NavLink>
          <NavLink
            to="/guests"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-[#376E6F] text-white' : 'text-gray-600 hover:bg-gray-100'}`
            }
          >
            Гости
          </NavLink>
        </div>
      </div>
      <button
        onClick={handleSignOut}
        className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        Выйти
      </button>
    </nav>
  )
}
