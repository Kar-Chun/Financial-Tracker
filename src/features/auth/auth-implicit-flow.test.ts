// @vitest-environment jsdom

import { createClient } from "@supabase/supabase-js"
import { afterEach, expect, it, vi } from "vitest"
import { clearAuthReturnParameters, getAuthReturnKind } from "@/features/auth/auth-redirect"

afterEach(() => window.history.replaceState(null, "", "/"))

it("lets the actual SDK establish an implicit confirmation session without a custom callback", async () => {
  window.history.replaceState(null, "", "/login#access_token=test-access&refresh_token=test-refresh&expires_in=3600&token_type=bearer&type=signup")
  expect(getAuthReturnKind(window.location.href)).toBe("implicit")
  // No real Auth endpoint or email is contacted by this test.
  const fetch = vi.fn(async () => new Response(JSON.stringify({
    id: "confirmed-user", aud: "authenticated", role: "authenticated",
    email: "confirmed@example.test", app_metadata: {}, user_metadata: {},
    created_at: "2026-09-19T00:00:00Z",
  }), { status: 200, headers: { "Content-Type": "application/json" } }))
  const client = createClient("https://auth.example.test", "test-publishable-key", {
    auth: { flowType: "implicit", detectSessionInUrl: true, autoRefreshToken: false, persistSession: false, storageKey: "confirmation-test" },
    global: { fetch },
  })
  try {
    expect((await client.auth.initialize()).error).toBeNull()
    clearAuthReturnParameters()
    const { data, error } = await client.auth.getSession()
    expect(error).toBeNull()
    expect(data.session?.user.id).toBe("confirmed-user")
    expect(window.location.pathname).toBe("/login")
    expect(window.location.hash).toBe("")
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0]).toEqual(expect.arrayContaining(["https://auth.example.test/auth/v1/user"]))
  } finally {
    await client.auth.stopAutoRefresh()
  }
})
