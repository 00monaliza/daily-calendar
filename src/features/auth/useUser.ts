import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/shared/api/supabaseClient'

export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, loading }
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signUp(email: string, password: string, fullName: string, phone: string) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error || !data.user) return { error }

  await supabase
    .from('profiles')
    .upsert({ id: data.user.id, full_name: fullName, phone })

  return { error: null, data }
}

export async function signOut() {
  return supabase.auth.signOut()
}

export async function requestPasswordReset(email: string, redirectTo: string) {
  return supabase.auth.resetPasswordForEmail(email, { redirectTo })
}

export async function initializeRecoverySessionFromUrlHash() {
  const queryParams = new URLSearchParams(window.location.search)
  const tokenHash = queryParams.get('token_hash')
  const recoveryType = queryParams.get('type')

  if (tokenHash && recoveryType === 'recovery') {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'recovery',
    })

    return { error }
  }

  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash
  const params = new URLSearchParams(hash)
  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')

  if (!accessToken || !refreshToken) {
    return { error: null }
  }

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  })

  return { error }
}

export async function updatePassword(newPassword: string) {
  return supabase.auth.updateUser({ password: newPassword })
}
