// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { MobileBottomNavigation } from "@/components/layout/mobile-bottom-navigation"

vi.mock("@/components/layout/user-menu", () => ({ UserMenu: () => <div>User menu</div> }))

describe("mobile bottom navigation", () => {
  it("groups real More destinations and closes the sheet after navigation", () => {
    render(<MemoryRouter initialEntries={["/budgets"]}>
      <MobileBottomNavigation />
      <Routes>
        <Route path="/budgets" element={<p>Budget page</p>} />
        <Route path="/goals" element={<p>Goals destination</p>} />
      </Routes>
    </MemoryRouter>)
    expect(screen.getByRole("button", { name: "More navigation options" })).toHaveAttribute("aria-current", "page")
    fireEvent.click(screen.getByRole("button", { name: "More navigation options" }))
    const navigation = within(screen.getByRole("navigation", { name: "More navigation" }))
    fireEvent.click(navigation.getByRole("link", { name: "Savings Goals" }))
    expect(screen.getByText("Goals destination")).toBeInTheDocument()
    expect(screen.queryByRole("navigation", { name: "More navigation" })).not.toBeInTheDocument()
  })

  it("links to the primary destinations and marks the current route active", () => {
    render(<MemoryRouter initialEntries={["/analytics"]}><MobileBottomNavigation /></MemoryRouter>)

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/dashboard")
    expect(screen.getByRole("link", { name: "Transactions" })).toHaveAttribute("href", "/transactions")
    expect(screen.getByRole("link", { name: "Analytics" })).toHaveAttribute("href", "/analytics")
    expect(screen.getByRole("link", { name: "Analytics" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("button", { name: "More navigation options" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "More navigation options" }))
    expect(screen.getByRole("link", { name: /Accounts/ })).toHaveAttribute("href", "/accounts")
    expect(screen.getByRole("link", { name: /Investments/ })).toHaveAttribute("href", "/investments")
    expect(screen.getByRole("link", { name: /Settings/ })).toHaveAttribute("href", "/settings")
    expect(screen.getByText("User menu")).toBeInTheDocument()
  })

})
