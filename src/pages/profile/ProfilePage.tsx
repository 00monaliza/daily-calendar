import { useState, useEffect } from 'react'
import { useUser } from '@/features/auth/useUser'
import { supabase } from '@/shared/api/supabaseClient'
import { toast } from '@/shared/ui/Toast'
import { Eye, EyeSlash } from '@phosphor-icons/react'

// ─── Profile Form ────────────────────────────────────────────────────────────

function ProfileForm() {
  const { user } = useUser()
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!user) return
    setEmail(user.email ?? '')
    supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setFullName(data.full_name ?? '')
          setPhone(data.phone ?? '')
        }
      })
  }, [user])

  function markDirty() {
    setDirty(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      toast.error('Введите корректный email')
      return
    }

    setLoading(true)
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ id: user.id, full_name: fullName, phone })

      if (profileError) throw profileError

      if (email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email })
        if (emailError) throw emailError
        toast.success('Письмо подтверждения отправлено на новый адрес')
      } else {
        toast.success('Профиль сохранён')
      }
      setDirty(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось сохранить')
    } finally {
      setLoading(false)
    }
  }

  const initials = (fullName || email).slice(0, 2).toUpperCase()

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h2 className="text-base font-semibold text-gray-800 mb-6">Профиль</h2>

      {/* Avatar */}
      <div className="flex justify-center mb-6">
        <div className="w-20 h-20 rounded-full bg-[#376E6F] text-white flex items-center justify-center text-2xl font-bold">
          {initials}
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Имя</label>
          <input
            value={fullName}
            onChange={e => { setFullName(e.target.value); markDirty() }}
            placeholder="Иван Иванов"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#376E6F]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Телефон</label>
          <input
            value={phone}
            onChange={e => { setPhone(e.target.value); markDirty() }}
            placeholder="+7 777 123 45 67"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#376E6F]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); markDirty() }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#376E6F]"
          />
          {email !== (user?.email ?? '') && (
            <p className="text-xs text-amber-600 mt-1">Потребуется подтверждение нового адреса</p>
          )}
        </div>

        <button
          type="submit"
          disabled={!dirty || loading}
          className="w-full bg-[#376E6F] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#1C3334] transition-colors disabled:opacity-40"
        >
          {loading ? 'Сохранение...' : 'Сохранить'}
        </button>
      </form>
    </div>
  )
}

// ─── Password Form ────────────────────────────────────────────────────────────

function PasswordRule({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs ${ok ? 'text-green-600' : 'text-gray-400'}`}>
      <span>{ok ? '✓' : '○'}</span>
      {label}
    </div>
  )
}

function PasswordForm() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  const hasLength = newPassword.length >= 8
  const hasDigit = /\d/.test(newPassword)
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword)
  const matches = newPassword === confirmPassword && newPassword.length > 0
  const canSubmit = hasLength && hasDigit && hasSpecial && matches

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      toast.success('Пароль изменён')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось изменить пароль')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h2 className="text-base font-semibold text-gray-800 mb-6">Безопасность</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Новый пароль</label>
          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#376E6F]"
              placeholder="Введите новый пароль"
            />
            <button
              type="button"
              onClick={() => setShowNew(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showNew ? <EyeSlash size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {newPassword.length > 0 && (
            <div className="mt-2 space-y-1">
              <PasswordRule ok={hasLength} label="Минимум 8 символов" />
              <PasswordRule ok={hasDigit} label="Содержит цифру" />
              <PasswordRule ok={hasSpecial} label="Содержит спецсимвол (!@#$%...)" />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Подтверждение пароля</label>
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#376E6F]"
              placeholder="Повторите пароль"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showConfirm ? <EyeSlash size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {confirmPassword.length > 0 && !matches && (
            <p className="text-xs text-red-500 mt-1">Пароли не совпадают</p>
          )}
        </div>

        <button
          type="submit"
          disabled={!canSubmit || loading}
          className="w-full bg-[#376E6F] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#1C3334] transition-colors disabled:opacity-40"
        >
          {loading ? 'Сохранение...' : 'Изменить пароль'}
        </button>
      </form>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ProfilePage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Личный кабинет</h1>
      <ProfileForm />
      <PasswordForm />
    </div>
  )
}
