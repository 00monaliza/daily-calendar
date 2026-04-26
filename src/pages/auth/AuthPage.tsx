import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { requestPasswordReset, signIn, signUp } from '@/features/auth/useUser'
import { Eye, EyeSlash } from '@phosphor-icons/react'

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setLoading(true)

    if (forgotPasswordMode) {
      const redirectTo = `${window.location.origin}/auth/reset-password`
      const { error: resetError } = await requestPasswordReset(email.trim(), redirectTo)

      if (resetError) {
        setError(resetError.message)
      } else {
        setNotice('Письмо для сброса пароля отправлено. Проверьте почту.')
      }

      setLoading(false)
      return
    }

    let authError
    if (mode === 'login') {
      ;({ error: authError } = await signIn(email.trim(), password))
    } else {
      ;({ error: authError } = await signUp(email.trim(), password, fullName, phone))
      if (!authError) {
        ;({ error: authError } = await signIn(email.trim(), password))
      }
    }

    if (authError) {
      setError(authError.message)
    } else {
      navigate('/')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#376E6F]">Pogostim</h1>
          <p className="text-gray-500 mt-1">Управление посуточной арендой</p>
        </div>

        <div className="flex rounded-lg overflow-hidden border border-gray-200 mb-6">
          <button
            className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'login' ? 'bg-[#376E6F] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            onClick={() => {
              setMode('login')
              setForgotPasswordMode(false)
              setError(null)
              setNotice(null)
            }}
          >
            Вход
          </button>
          <button
            className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'register' ? 'bg-[#376E6F] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            onClick={() => {
              setMode('register')
              setForgotPasswordMode(false)
              setError(null)
              setNotice(null)
            }}
          >
            Регистрация
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && !forgotPasswordMode && (
            <>
              <div>
                <label htmlFor="auth-fullname" className="block text-sm font-medium text-gray-700 mb-1">Полное имя</label>
                <input
                  id="auth-fullname"
                  type="text"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#376E6F] focus:border-transparent"
                  placeholder="Иван Иванов"
                />
              </div>
              <div>
                <label htmlFor="auth-phone" className="block text-sm font-medium text-gray-700 mb-1">Номер телефона</label>
                <input
                  id="auth-phone"
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#376E6F] focus:border-transparent"
                  placeholder="+7 999 123 45 67"
                />
              </div>
            </>
          )}

          {forgotPasswordMode && (
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">
              Введите email аккаунта. Мы отправим ссылку для сброса пароля.
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#376E6F] focus:border-transparent"
              placeholder="your@email.com"
            />
          </div>

          {!forgotPasswordMode && (
            <>
              <div>
                <label htmlFor="auth-password" className="block text-sm font-medium text-gray-700 mb-1">Пароль</label>
                <div className="relative">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-[#376E6F] focus:border-transparent"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  >
                    {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {mode === 'login' && (
                <div className="text-right">
                  <button
                    type="button"
                    className="text-sm text-[#376E6F] hover:underline"
                    onClick={() => {
                      setForgotPasswordMode(true)
                      setError(null)
                      setNotice(null)
                    }}
                  >
                    Забыли пароль?
                  </button>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {notice && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-3 py-2">
              {notice}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#376E6F] text-white py-2.5 rounded-lg font-medium hover:bg-[#1C3334] transition-colors disabled:opacity-50"
          >
            {loading
              ? 'Загрузка...'
              : forgotPasswordMode
                ? 'Отправить ссылку'
                : mode === 'login'
                  ? 'Войти'
                  : 'Зарегистрироваться'}
          </button>

          {forgotPasswordMode && (
            <button
              type="button"
              className="w-full border border-gray-300 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              onClick={() => {
                setForgotPasswordMode(false)
                setError(null)
                setNotice(null)
              }}
            >
              Назад ко входу
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
