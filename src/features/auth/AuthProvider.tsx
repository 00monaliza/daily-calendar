import { createContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/shared/api/supabaseClient'

export interface AuthContextValue {
  user: User | null
  loading: boolean
}

export const AuthContext = createContext<AuthContextValue>({ user: null, loading: true })

/**
 * Single source of truth for the current auth session, mounted once at the
 * app root. Previously every useUser() call site (14+ across the app) ran
 * its own supabase.auth.getUser() + onAuthStateChange subscription — a
 * thundering herd of concurrent /auth/v1/user requests on every page load.
 * If any one of those independent calls failed or got superseded (no retry,
 * no .catch existed), that component's `user` stayed null forever with no
 * error surfaced — e.g. BookingModal's Save button would silently no-op.
 * Fetching and subscribing exactly once here removes the race entirely.
 */
const GET_USER_TIMEOUT_MS = 10_000

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    // On a flaky mobile connection (backgrounded tab, weak signal) this
    // request can hang indefinitely with no built-in timeout, which left
    // `loading` — and ProtectedRoute's spinner — stuck forever. Time it out
    // so the app falls through to the normal signed-out flow instead of
    // hanging; onAuthStateChange below will still correct `user` once the
    // request (or a retry) eventually completes.
    const timeoutId = window.setTimeout(() => {
      if (!active) return
      setLoading(false)
    }, GET_USER_TIMEOUT_MS)

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!active) return
        window.clearTimeout(timeoutId)
        setUser(data.user)
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        window.clearTimeout(timeoutId)
        setLoading(false)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      active = false
      window.clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [])

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>
}
