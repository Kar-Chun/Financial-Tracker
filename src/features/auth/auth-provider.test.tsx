// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import type { AuthChangeEvent, Session } from "@supabase/supabase-js"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AuthProvider } from "@/features/auth/auth-provider"
import { useAuth } from "@/features/auth/auth-context"
import { PublicOnlyRoute } from "@/features/auth/route-guards"

const authMocks = vi.hoisted(() => ({
  callback: undefined as ((event: AuthChangeEvent, session: Session | null) => void) | undefined,
  getSession: vi.fn(),
  unsubscribe: vi.fn(),
  initialize: vi.fn(),
  returnKind: null as "implicit" | "invalid" | null,
}))

vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: true,
  get authReturnKind() { return authMocks.returnKind },
  supabase: {
    auth: {
      getSession: authMocks.getSession,
      initialize: authMocks.initialize,
      onAuthStateChange: (callback: (event: AuthChangeEvent, session: Session | null) => void) => {
        authMocks.callback = callback
        return { data: { subscription: { unsubscribe: authMocks.unsubscribe } } }
      },
    },
  },
}))

beforeEach(() => {
  authMocks.returnKind = null
  authMocks.callback = undefined
  authMocks.initialize.mockReset().mockResolvedValue({ error: null })
  authMocks.getSession.mockReset().mockResolvedValue({ data: { session: null }, error: null })
  window.history.replaceState(null, "", "/")
})

describe("AuthProvider cache lifecycle", () => {
  it("waits for SDK URL initialization, removes credentials, then navigates once to Dashboard", async () => {
    authMocks.returnKind = "implicit"
    window.history.replaceState(null, "", "/login#access_token=test-access&refresh_token=test-refresh&expires_in=3600&token_type=bearer")
    let complete!: (value: { error: null }) => void
    authMocks.initialize.mockReturnValue(new Promise((resolve) => { complete = resolve }))
    authMocks.getSession.mockResolvedValue({ data: { session: session("confirmed-user") }, error: null })
    render(<QueryClientProvider client={new QueryClient()}><AuthProvider>
      <MemoryRouter initialEntries={["/login"]}><Routes>
        <Route element={<PublicOnlyRoute />}><Route path="/login" element={<p>Login screen</p>} /></Route>
        <Route path="/dashboard" element={<AuthProbe />} />
      </Routes></MemoryRouter>
    </AuthProvider></QueryClientProvider>)
    expect(window.location.hash).toContain("test-access")
    expect(screen.queryByText("Login screen")).not.toBeInTheDocument()
    await act(async () => { complete({ error: null }) })
    expect(await screen.findByText("confirmed-user")).toBeInTheDocument()
    expect(window.location.hash).toBe("")
    expect(authMocks.initialize).toHaveBeenCalledTimes(1)
    act(() => authMocks.callback?.("TOKEN_REFRESHED", session("confirmed-user")))
    expect(screen.getByText("confirmed-user")).toBeInTheDocument()
  })

  it.each(["invalid", "implicit"] as const)("shows safe %s-return errors even with an existing session, without leaking SDK details", async (kind) => {
    authMocks.returnKind = kind
    window.history.replaceState(null, "", "/login?error=access_denied&error_description=private-test-detail#refresh_token=private-test-token")
    authMocks.initialize.mockResolvedValue({ error: { message: "private-test-detail" } })
    authMocks.getSession.mockResolvedValue({ data: { session: session("existing-user") }, error: null })
    render(<QueryClientProvider client={new QueryClient()}><AuthProvider><AuthProbe /></AuthProvider></QueryClientProvider>)
    expect(await screen.findByRole("alert")).toHaveTextContent("invalid, expired, or could not be verified")
    expect(document.body.textContent).not.toContain("private-test")
    expect(window.location.href).not.toContain("private-test")
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login")
    expect(screen.queryByText("existing-user")).not.toBeInTheDocument()
  })

  it("handles a failed SDK initialization safely and still scrubs return parameters", async () => {
    authMocks.returnKind = "implicit"
    window.history.replaceState(null, "", "/login#access_token=test-access")
    authMocks.initialize.mockRejectedValue(new Error("private-test-error"))
    render(<QueryClientProvider client={new QueryClient()}><AuthProvider><AuthProbe /></AuthProvider></QueryClientProvider>)
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument())
    expect(window.location.hash).toBe("")
    expect(document.body.textContent).not.toContain("private-test-error")
  })

  it("does not pretend confirmation succeeded when no session was established", async () => {
    authMocks.returnKind = "implicit"
    render(<QueryClientProvider client={new QueryClient()}><AuthProvider><AuthProbe /></AuthProvider></QueryClientProvider>)
    expect(await screen.findByRole("alert")).toBeInTheDocument()
    expect(screen.queryByText("signed-out")).not.toBeInTheDocument()
  })

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
