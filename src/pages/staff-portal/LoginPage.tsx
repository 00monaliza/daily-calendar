import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { signIn } from '@/features/auth/useUser'
import { buildStaffSyntheticEmail } from '@/shared/lib/staffAuthEmail'
import { PinInput } from '@/shared/ui/PinInput'

export function StaffPortalLoginPage() {
  const [login, setLogin] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    let email: string
    try {
      email = buildStaffSyntheticEmail(login)
    } catch {
      setError('Введите логин')
      return
    }

    setLoading(true)
    const { error: authError } = await signIn(email, pin)
    setLoading(false)

    if (authError) {
      setError('Неверный логин или PIN')
      return
    }

    navigate('/schedule')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#376E6F]">Pogostim Staff</h1>
          <p className="text-gray-500 mt-1 text-sm">Вход по логину и PIN-коду</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm">
            <span className="block text-gray-500 mb-1">Логин</span>
            <input
              type="text"
              required
              value={login}
              onChange={e => setLogin(e.target.value)}
              placeholder="Телефон или имя пользователя"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#376E6F]"
            />
          </label>

          <label className="block text-sm">
            <span className="block text-gray-500 mb-1">PIN</span>
            <PinInput value={pin} onChange={setPin} />
          </label>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#376E6F] text-white py-2.5 rounded-lg font-medium hover:bg-[#1C3334] transition-colors disabled:opacity-50"
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  )
}
