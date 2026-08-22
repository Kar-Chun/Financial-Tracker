import { useEffect, useMemo, useState, type ReactNode } from "react"
import type { Session } from "@supabase/supabase-js"

import { AuthContext, type AuthContextValue } from "@/features/auth/auth-context"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!supabase) return

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setIsLoading(false)
    })

    void supabase.auth.getSession().then(({ data: sessionData }) => {
      setSession(sessionData.session)
      setIsLoading(false)
    })

    return () => data.subscription.unsubscribe()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      configurationError: isSupabaseConfigured
        ? null
        : "Supabase environment variables are missing.",
    }),
    [isLoading, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
