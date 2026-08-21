import { useContext } from 'react'
import { supabase } from '@/shared/api/supabaseClient'
import { AuthContext } from './AuthProvider'

/**
 * Reads the single shared auth session set up once by <AuthProvider> at the
 * app root — see AuthProvider.tsx for why this used to fetch independently
 * per call site.
 */
export function useUser() {
  return useContext(AuthContext)
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
