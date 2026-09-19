// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"
import { clearAuthReturnParameters, getAuthReturnKind, getConfirmationRedirectUrl } from "@/features/auth/auth-redirect"
import { signUp } from "@/features/auth/auth-service"

const auth = vi.hoisted(() => ({ signUp: vi.fn() }))
vi.mock("@/lib/supabase", () => ({ getSupabaseClient: () => ({ auth }) }))

beforeEach(() => {
  auth.signUp.mockReset().mockResolvedValue({ data: { session: null }, error: null })
  window.history.replaceState(null, "", "/signup")
})

describe("confirmation redirect", () => {
  it.each([
    ["https://finance.example.test", "https://finance.example.test/login"],
    ["http://localhost:5173", "http://localhost:5173/login"],
    ["http://localhost:5174", "http://localhost:5174/login"],
    ["http://127.0.0.1:5173", "http://127.0.0.1:5173/login"],
  ])("uses the active %s origin without a universal localhost fallback", (origin, expected) => {
    expect(getConfirmationRedirectUrl(origin)).toBe(expected)
  })
  it("never copies credentials, path, query, hash or next URLs into the redirect", () => {
    expect(getConfirmationRedirectUrl("https://user:password@finance.example.test/signup?next=https://elsewhere.test&token_hash=test#access_token=test")).toBe("https://finance.example.test/login")
    expect(() => getConfirmationRedirectUrl("file:///app")).toThrow("HTTP or HTTPS")
  })
  it("supplies emailRedirectTo while preserving signup credentials and metadata", async () => {
    await signUp({ email: "user@example.test", password: "test-password", displayName: " Alex " })
    expect(auth.signUp).toHaveBeenCalledExactlyOnceWith({
      email: "user@example.test", password: "test-password",
      options: { emailRedirectTo: new URL("/login", window.location.origin).href, data: { display_name: "Alex" } },
    })
  })
  it.each([
    ["#error=access_denied&error_code=otp_expired", "invalid"],
    ["?error_description=untrusted", "invalid"],
    ["?token_hash=test&type=email", "invalid"],
    ["?code=test", "invalid"],
    ["#access_token=test&refresh_token=test", "implicit"],
    ["#refresh_token=incomplete", "implicit"],
    ["?confirmed=true", null],
    ["#section", null],
  ])("classifies %s without accepting another confirmation architecture", (suffix, expected) => {
    expect(getAuthReturnKind("https://finance.example.test/login" + suffix)).toBe(expected)
  })
  it("scrubs sensitive query/hash fields and error descriptions without discarding router state", () => {
    window.history.replaceState({ key: "router-state" }, "", "/login?error_description=secret&code=secret&keep=yes#access_token=secret&refresh_token=secret&type=signup")
    clearAuthReturnParameters()
    expect(window.location.pathname + window.location.search + window.location.hash).toBe("/login?keep=yes")
    expect(window.history.state).toEqual({ key: "router-state" })
  })
  it("leaves normal application URLs untouched", () => {
    window.history.replaceState(null, "", "/login?keep=yes#section")
    clearAuthReturnParameters()
    expect(window.location.hash).toBe("#section")
    expect(window.location.search).toBe("?keep=yes")
  })
})
