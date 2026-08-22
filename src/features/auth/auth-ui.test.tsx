// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { createMemoryRouter, MemoryRouter, RouterProvider } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { AuthContext, type AuthContextValue } from "@/features/auth/auth-context"
import { AuthPage } from "@/features/auth/auth-page"
import { ProtectedRoute } from "@/features/auth/route-guards"

const signedOut: AuthContextValue = {
  session: null,
  user: null,
  isLoading: false,
  configurationError: null,
}

describe("authentication UI", () => {
  it("renders the email/password login form", () => {
    renderWithProviders(<AuthPage mode="login" />)

    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument()
    expect(screen.getByLabelText("Email")).toBeInTheDocument()
    expect(screen.getByLabelText("Password")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument()
  })

  it("renders signup with display name and confirmation-ready copy", () => {
    renderWithProviders(<AuthPage mode="signup" />)

    expect(screen.getByRole("heading", { name: "Create your workspace" })).toBeInTheDocument()
    expect(screen.getByLabelText("Display name")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument()
  })

  it("redirects a signed-out user away from a protected route", async () => {
    const router = createMemoryRouter(
      [
        {
          element: <ProtectedRoute />,
          children: [{ path: "/dashboard", element: <p>Private dashboard</p> }],
        },
        { path: "/login", element: <p>Login destination</p> },
      ],
      { initialEntries: ["/dashboard"] },
    )

    render(
      <AuthContext.Provider value={signedOut}>
        <RouterProvider router={router} />
      </AuthContext.Provider>,
    )

    expect(await screen.findByText("Login destination")).toBeInTheDocument()
    expect(screen.queryByText("Private dashboard")).not.toBeInTheDocument()
  })
})

function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={signedOut}>
        <MemoryRouter>{ui}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}
