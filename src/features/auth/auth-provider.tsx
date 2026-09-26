import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { Session } from "@supabase/supabase-js"

import { clearSensitiveCacheForUserChange } from "@/features/auth/auth-cache"
import { AuthContext, type AuthContextValue } from "@/features/auth/auth-context"
import { AuthConfirmationError } from "@/features/auth/auth-confirmation-error"
import { clearAuthReturnParameters } from "@/features/auth/auth-redirect"
import { authReturnKind, isSupabaseConfigured, supabase } from "@/lib/supabase"

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured)
  const [confirmationError, setConfirmationError] = useState(false)
  const currentUserId = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    let active = true
    let ready = authReturnKind === null
    let latestSession: Session | null = null

    let authEventReceived = false
    const applySession = (nextSession: Session | null) => {
      const nextUserId = nextSession?.user.id ?? null
      clearSensitiveCacheForUserChange(queryClient, currentUserId.current, nextUserId)
      currentUserId.current = nextUserId
      setSession(nextSession)
      setIsLoading(false)
    }

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      authEventReceived = true
      latestSession = nextSession
      if (ready) applySession(nextSession)
    })

    const bootstrap = async () => {
      try {
        let invalidReturn = authReturnKind === "invalid"
        if (authReturnKind !== null) {
          // initialize() reuses the SDK's initialization promise. Do not
          // verifyOtp/exchange tokens a second time or erase its URL early.
          const result = await client.auth.initialize()
          invalidReturn ||= Boolean(result.error)
          if (!active) return
          clearAuthReturnParameters()
        }
        const { data: sessionData, error } = await client.auth.getSession()
        if (!active) return
        ready = true
        const nextSession = authEventReceived ? latestSession : sessionData.session
        if (authReturnKind !== null) {
          setConfirmationError(invalidReturn || Boolean(error) || !nextSession)
          applySession(nextSession)
        } else if (!authEventReceived) {
          applySession(nextSession)
        }
      } catch {
        if (!active) return
        ready = true
        if (authReturnKind !== null) {
          clearAuthReturnParameters()
          setConfirmationError(true)
        }
        applySession(authEventReceived ? latestSession : null)
      }
    }
    void bootstrap()

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
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

  // Clearing QueryClient alone does not reset every mounted QueryObserver.
  // Remount consumers on identity changes so none can retain another user's
  // rendered result or local form state. Token refresh keeps the same key.
  return <AuthContext.Provider value={value}><Fragment key={session?.user.id ?? "signed-out"}>{confirmationError ? <AuthConfirmationError /> : children}</Fragment></AuthContext.Provider>
}
