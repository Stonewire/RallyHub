import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabase'
import type { AppRole } from '@/types/database'
import type { Tables } from '@/types/helpers'

type Profile = Tables<'profiles'>

type AuthContextValue = {
  user: User | null
  session: Session | null
  profile: Profile | null
  role: AppRole | null
  loading: boolean
  profileLoading: boolean
  signInWithPassword: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(({ data: { session: next } }) => {
      if (!cancelled) setSession(next)
      if (!cancelled) setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) {
      setProfile(null)
      setProfileLoading(false)
      return
    }

    let cancelled = false
    setProfileLoading(true)

    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.warn('[RallyHub] profile fetch failed', error.message)
          setProfile(null)
        } else {
          setProfile(data ?? null)
        }
        setProfileLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [session?.user?.id])

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
    },
    [],
  )

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  const resolvedProfile =
    session?.user?.id && profile && profile.id === session.user.id
      ? profile
      : null

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      profile: resolvedProfile,
      role: resolvedProfile?.role ?? null,
      loading,
      profileLoading: Boolean(session?.user?.id) && profileLoading,
      signInWithPassword,
      signOut,
    }),
    [
      session,
      resolvedProfile,
      loading,
      profileLoading,
      signInWithPassword,
      signOut,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- companion hook for AuthProvider
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
