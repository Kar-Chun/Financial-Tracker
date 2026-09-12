// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AuthPage } from "@/features/auth/auth-page"

const mocks = vi.hoisted(() => ({ signIn: vi.fn(), signUp: vi.fn() }))
vi.mock("@/features/auth/auth-context", () => ({ useAuth: () => ({ configurationError: null }) }))
vi.mock("@/features/auth/auth-service", () => ({ signIn: mocks.signIn, signUp: mocks.signUp }))

beforeEach(() => vi.clearAllMocks())

function renderAuth(mode: "login" | "signup") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[{ pathname: "/auth", state: { from: "/goals" } }]}>
    <Routes><Route path="/auth" element={<AuthPage mode={mode} />} /><Route path="/goals" element={<p>Goals destination</p>} /></Routes>
  </MemoryRouter></QueryClientProvider>)
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "test@example.com" } })
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "test-password" } })
}

describe("Refreshed auth form actions", () => {
  it("keeps login credentials and the requested return route intact", async () => {
    mocks.signIn.mockResolvedValue({ session: {} })
    renderAuth("login")
    fireEvent.click(screen.getByRole("button", { name: "Log in" }))
    expect(await screen.findByText("Goals destination")).toBeInTheDocument()
    expect(mocks.signIn).toHaveBeenCalledWith("test@example.com", "test-password")
  })

  it("keeps signup confirmation separate from a signed-in session", async () => {
    mocks.signUp.mockResolvedValue({ session: null })
    renderAuth("signup")
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Alex" } })
    fireEvent.click(screen.getByRole("button", { name: "Create account" }))
    await waitFor(() => expect(screen.getByRole("heading", { name: "Check your email" })).toBeInTheDocument())
    expect(screen.getByText("test@example.com")).toBeInTheDocument()
    expect(screen.queryByText("Goals destination")).not.toBeInTheDocument()
    expect(mocks.signUp).toHaveBeenCalledWith({ displayName: "Alex", email: "test@example.com", password: "test-password" })
  })
})
