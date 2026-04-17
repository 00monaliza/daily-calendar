import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  initializeRecoverySessionFromUrlHash,
  updatePassword,
} from '@/features/auth/useUser'
import { supabase } from '@/shared/api/supabaseClient'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    let active = true

    async function initRecoverySession() {
      const { error: initError } = await initializeRecoverySessionFromUrlHash()
      if (!active) return

      if (initError) {
        setError(initError.message)
        setInitializing(false)
        return
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (!active) return

      if (userError || !user) {
        setError('Ссылка для сброса недействительна или уже истекла. Запросите новую.')
      }

      setInitializing(false)
    }

    initRecoverySession()

    return () => {
      active = false
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Пароль должен быть не короче 6 символов')
      return
    }

    if (password !== confirmPassword) {
      setError('Пароли не совпадают')
      return
    }

    setLoading(true)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setError('Сессия восстановления не найдена. Откройте ссылку из письма ещё раз.')
      setLoading(false)
      return
    }

    const { error: updateError } = await updatePassword(password)

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    await supabase.auth.signOut()
    setSuccess(true)
    setLoading(false)
  }

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md text-center">
          <div className="mx-auto mb-4 w-8 h-8 border-4 border-[#376E6F] border-t-transparent rounded-full animate-spin" />
          <h1 className="text-xl font-semibold text-gray-900">Проверяем ссылку</h1>
          <p className="text-sm text-gray-500 mt-2">Это займёт пару секунд</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
          <h1 className="text-2xl font-bold text-[#376E6F] text-center">Пароль обновлён</h1>
          <p className="text-sm text-gray-600 mt-3 text-center">
            Теперь войдите с новым паролем.
          </p>
          <button
            type="button"
            className="mt-6 w-full bg-[#376E6F] text-white py-2.5 rounded-lg font-medium hover:bg-[#1C3334] transition-colors"
            onClick={() => navigate('/auth')}
          >
            Перейти ко входу
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-[#376E6F] text-center">Сброс пароля</h1>
        <p className="text-sm text-gray-600 mt-2 text-center">
          Введите новый пароль для вашего аккаунта.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div>
            <label htmlFor="reset-password" className="block text-sm font-medium text-gray-700 mb-1">Новый пароль</label>
            <input
              id="reset-password"
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#376E6F] focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label htmlFor="reset-password-confirm" className="block text-sm font-medium text-gray-700 mb-1">Подтвердите пароль</label>
            <input
              id="reset-password-confirm"
              type="password"
              required
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#376E6F] focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#376E6F] text-white py-2.5 rounded-lg font-medium hover:bg-[#1C3334] transition-colors disabled:opacity-50"
          >
            {loading ? 'Сохранение...' : 'Сохранить новый пароль'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          <Link to="/auth" className="text-[#376E6F] hover:underline">
            Вернуться на страницу входа
          </Link>
        </p>
      </div>
    </div>
  )
}
