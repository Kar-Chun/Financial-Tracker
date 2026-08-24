// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen } from "@testing-library/react"
import type { AuthChangeEvent, Session } from "@supabase/supabase-js"
import { describe, expect, it, vi } from "vitest"

import { AuthProvider } from "@/features/auth/auth-provider"
import { useAuth } from "@/features/auth/auth-context"

const authMocks = vi.hoisted(() => ({
  callback: undefined as ((event: AuthChangeEvent, session: Session | null) => void) | undefined,
  getSession: vi.fn(),
  unsubscribe: vi.fn(),
}))

vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: authMocks.getSession,
      onAuthStateChange: (callback: (event: AuthChangeEvent, session: Session | null) => void) => {
        authMocks.callback = callback
        return { data: { subscription: { unsubscribe: authMocks.unsubscribe } } }
      },
    },
  },
}))

describe("AuthProvider cache lifecycle", () => {
  it("preserves queries on token refresh but clears them for user changes and logout", async () => {
    const userA = session("user-a")
    const userB = session("user-b")
    authMocks.getSession.mockResolvedValue({ data: { session: userA } })
    const queryClient = new QueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider><AuthProbe /></AuthProvider>
      </QueryClientProvider>,
    )
    expect(await screen.findByText("user-a")).toBeInTheDocument()
    queryClient.setQueryData(["dashboard"], { owner: "user-a" })

    act(() => authMocks.callback?.("TOKEN_REFRESHED", userA))
    expect(queryClient.getQueryData(["dashboard"])).toEqual({ owner: "user-a" })

    act(() => authMocks.callback?.("SIGNED_IN", userB))
    expect(queryClient.getQueryData(["dashboard"])).toBeUndefined()
    expect(screen.getByText("user-b")).toBeInTheDocument()

    queryClient.setQueryData(["accounts"], [{ owner: "user-b" }])
    act(() => authMocks.callback?.("SIGNED_OUT", null))
    expect(queryClient.getQueryData(["accounts"])).toBeUndefined()
    expect(screen.getByText("signed-out")).toBeInTheDocument()
  })
})

function AuthProbe() {
  const { user, isLoading } = useAuth()
  return <p>{isLoading ? "loading" : user?.id ?? "signed-out"}</p>
}

function session(userId: string) {
  return { user: { id: userId } } as Session
}
