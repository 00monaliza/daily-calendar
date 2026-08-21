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
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!active) return
        setUser(data.user)
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
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
      subscription.unsubscribe()
    }
  }, [])

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>
}
