import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { signOut } from '@/features/auth/useUser'

export function TopNav() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/auth')
  }

  function handleRefresh() {
    if (refreshing) return
    setRefreshing(true)
    queryClient.invalidateQueries()
    setTimeout(() => setRefreshing(false), 1000)
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
      <div className="flex items-center gap-3">
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className={`text-lg text-gray-500 hover:text-gray-700 transition-colors disabled:cursor-not-allowed inline-block ${refreshing ? 'animate-spin' : ''}`}
          title="Обновить данные"
        >
          ↻
        </button>
        <button
          onClick={handleSignOut}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          Выйти
        </button>
      </div>
    </nav>
  )
}
