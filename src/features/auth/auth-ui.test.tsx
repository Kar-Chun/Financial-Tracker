// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import { createMemoryRouter, RouterProvider } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { AuthContext, type AuthContextValue } from "@/features/auth/auth-context"
import { ProtectedRoute } from "@/features/auth/route-guards"

const signedOut: AuthContextValue = {
  session: null,
  user: null,
  isLoading: false,
  configurationError: null,
}

describe("authentication UI", () => {
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
