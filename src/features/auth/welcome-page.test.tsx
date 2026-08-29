// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { WelcomePage } from "@/features/auth/welcome-page"

describe("WelcomePage", () => {
  it("uses safe-area-aware mobile spacing and clear unauthenticated actions", () => {
    const { container } = render(<MemoryRouter><WelcomePage /></MemoryRouter>)

    expect(screen.getByRole("heading", { name: "Your finances, clear and connected." })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Create account" })).toHaveAttribute("href", "/signup")
    for (const login of screen.getAllByRole("link", { name: "Log in" })) {
      expect(login).toHaveAttribute("href", "/login")
    }
    expect(screen.queryByRole("link", { name: /open dashboard/i })).not.toBeInTheDocument()
    expect(container.querySelector("header")?.className).toContain("env(safe-area-inset-top)")
    expect(screen.queryByText("A clearer daily money habit")).not.toBeInTheDocument()
  })
})
