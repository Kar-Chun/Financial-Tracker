import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { Session } from "@supabase/supabase-js"

import { clearSensitiveCacheForUserChange } from "@/features/auth/auth-cache"
import { AuthContext, type AuthContextValue } from "@/features/auth/auth-context"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured)
  const currentUserId = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    if (!supabase) return

    let authEventReceived = false
    const applySession = (nextSession: Session | null) => {
      const nextUserId = nextSession?.user.id ?? null
      clearSensitiveCacheForUserChange(queryClient, currentUserId.current, nextUserId)
      currentUserId.current = nextUserId
      setSession(nextSession)
      setIsLoading(false)
    }

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      authEventReceived = true
      applySession(nextSession)
    })

    void supabase.auth.getSession().then(({ data: sessionData }) => {
      if (!authEventReceived) applySession(sessionData.session)
    })

    return () => data.subscription.unsubscribe()
  }, [queryClient])

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
