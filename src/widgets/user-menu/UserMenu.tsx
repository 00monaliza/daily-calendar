import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { User, Gear, SignOut, ArrowClockwise } from '@phosphor-icons/react'
import { signOut, useUser } from '@/features/auth/useUser'

export function UserMenu() {
  const { user } = useUser()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  async function handleSignOut() {
    setOpen(false)
    await signOut()
    navigate('/auth')
  }

  function handleRefresh() {
    if (refreshing) return
    setRefreshing(true)
    queryClient.invalidateQueries()
    setTimeout(() => setRefreshing(false), 1000)
    setOpen(false)
  }

  const email = user?.email ?? ''
  const initials = email.slice(0, 2).toUpperCase()

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 rounded-full p-1 hover:bg-gray-100 transition-colors"
        aria-label="Личный кабинет"
      >
        <div className="w-8 h-8 rounded-full bg-[#376E6F] text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
          {initials}
        </div>
        <span className="hidden md:block text-sm text-gray-700 max-w-[140px] truncate pr-1">
          {email}
        </span>
      </button>

      {open && (
        <>
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 z-40 md:hidden"
            onClick={() => setOpen(false)}
          />

          <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs text-gray-400 mb-0.5">Аккаунт</p>
              <p className="text-sm font-medium text-gray-800 truncate">{email}</p>
            </div>

            {/* Items */}
            <div className="py-1">
              <MenuItem icon={<User size={18} />} label="Личный кабинет" onClick={() => { setOpen(false); navigate('/profile') }} />
              <MenuItem icon={<Gear size={18} />} label="Настройки" onClick={() => { setOpen(false); navigate('/settings') }} />
            </div>

            <div className="border-t border-gray-100 py-1">
              <MenuItem
                icon={<ArrowClockwise size={18} className={refreshing ? 'animate-spin' : ''} />}
                label="Обновить данные"
                onClick={handleRefresh}
              />
              <MenuItem
                icon={<SignOut size={18} />}
                label="Выйти"
                onClick={handleSignOut}
                danger
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors min-h-[44px] ${
        danger
          ? 'text-red-500 hover:bg-red-50'
          : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      <span className="flex-shrink-0">{icon}</span>
      {label}
    </button>
  )
}
