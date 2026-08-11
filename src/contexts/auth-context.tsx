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

import { setLiveJoinToken, supabase } from '@/lib/supabase'
import { looksLikeEmail } from '@/lib/auth-identifier'
import { enterDemoSandbox, isDemoHost } from '@/lib/demo-sandbox'
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
  authError: string | null
  signInWithPassword: (email: string, password: string) => Promise<void>
  signInWithIdentifier: (identifier: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  // Which user id `profile` actually reflects (or has finished trying to fetch
  // for). Plain `profileLoading` alone isn't enough: it settles back to false
  // between the session resolving and the profile-fetch effect for the NEW
  // user id re-arming it, so role-gated redirects (RequireAuth and friends)
  // could briefly read `role: null` for a signed-in user and bounce to a
  // default route instead of the page that was actually reloaded.
  const [profileUserId, setProfileUserId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function initializeSession() {
      try {
        let { data: { session: next } } = await supabase.auth.getSession()

        if (
          isDemoHost() &&
          next?.user.user_metadata?.rallyhub_demo !== true
        ) {
          await enterDemoSandbox()
          const refreshed = await supabase.auth.getSession()
          next = refreshed.data.session
        }

        if (!cancelled) {
          setSession(next)
          setAuthError(null)
        }
      } catch (error) {
        if (!cancelled) {
          setSession(null)
          setAuthError(
            error instanceof Error ? error.message : 'The demo is temporarily unavailable.',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void initializeSession()

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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to the auth session (an external system) changing to logged-out; re-verified live 2026-07-08 (V2.4.2 reload-bug fix)
      setProfile(null)
      setProfileLoading(false)
      setProfileUserId(null)
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
        setProfileUserId(userId)
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

  const signInWithIdentifier = useCallback(
    async (identifier: string, password: string) => {
      const trimmed = identifier.trim()
      if (!trimmed) {
        throw new Error('No account found for that username or email.')
      }
      // Email-shaped input signs in directly. A username is resolved AND signed
      // in server-side (the login-identifier edge function) so the account's
      // email is never sent back to the browser (audit AUD-4: the old
      // resolve_login_email RPC leaked it to any anonymous caller).
      if (looksLikeEmail(trimmed)) {
        await signInWithPassword(trimmed.toLowerCase(), password)
        return
      }
      const { data, error } = await supabase.functions.invoke('login-identifier', {
        body: { identifier: trimmed, password },
      })
      if (
        error ||
        !data?.session?.access_token ||
        !data?.session?.refresh_token
      ) {
        throw new Error('No account found for that username or email, or the password is incorrect.')
      }
      const { error: setError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      })
      if (setError) throw setError
    },
    [signInWithPassword],
  )

  const refreshProfile = useCallback(async () => {
    const userId = session?.user?.id
    if (!userId) {
      setProfile(null)
      return
    }
    setProfileLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (error) {
      console.warn('[RallyHub] profile fetch failed', error.message)
      setProfile(null)
    } else {
      setProfile(data ?? null)
    }
    setProfileLoading(false)
  }, [session?.user?.id])

  const signOut = useCallback(async () => {
    setLiveJoinToken(null)
    setSession(null)
    setProfile(null)
    setProfileLoading(false)
    setProfileUserId(null)

    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('[RallyHub] signOut failed', error.message)
      const { error: localError } = await supabase.auth.signOut({ scope: 'local' })
      if (localError) {
        console.error('[RallyHub] local signOut failed', localError.message)
        throw localError
      }
    }
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
      profileLoading:
        Boolean(session?.user?.id) &&
        (profileLoading || profileUserId !== session?.user?.id),
      authError,
      signInWithPassword,
      signInWithIdentifier,
      signOut,
      refreshProfile,
    }),
    [
      session,
      resolvedProfile,
      loading,
      profileLoading,
      profileUserId,
      authError,
      signInWithPassword,
      signInWithIdentifier,
      signOut,
      refreshProfile,
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
