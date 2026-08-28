// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { MobileBottomNavigation, MobileQuickAddButton } from "@/components/layout/mobile-bottom-navigation"

vi.mock("@/components/layout/user-menu", () => ({ UserMenu: () => <div>User menu</div> }))

describe("mobile bottom navigation", () => {
  it("contains four balanced destinations without treating Quick Add as navigation", () => {
    render(<MemoryRouter initialEntries={["/dashboard"]}><MobileBottomNavigation /></MemoryRouter>)

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/dashboard")
    expect(screen.getByRole("link", { name: "Transactions" })).toHaveAttribute("href", "/transactions")
    expect(screen.getByRole("link", { name: "Analytics" })).toHaveAttribute("href", "/analytics")
    expect(screen.getByRole("button", { name: "More navigation options" })).toBeInTheDocument()
    const navigation = screen.getByRole("navigation", { name: "Mobile navigation" })
    expect(navigation.querySelectorAll(":scope > div > *")).toHaveLength(4)
    expect(navigation).toHaveAttribute("data-layout", "edge-bar")
    expect(navigation).toHaveClass("right-0", "bottom-0", "left-0")
    expect(screen.queryByRole("button", { name: "Quick add transaction" })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "More navigation options" }))
    expect(screen.getByRole("link", { name: /Accounts/ })).toHaveAttribute("href", "/accounts")
    expect(screen.getByRole("link", { name: /Investments/ })).toHaveAttribute("href", "/investments")
    expect(screen.getByRole("link", { name: /Settings/ })).toHaveAttribute("href", "/settings")
    expect(screen.getByText("User menu")).toBeInTheDocument()
  })

  it("navigates to the dedicated Add Transaction route from the floating action", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <MobileQuickAddButton />
        <Routes><Route path="/transactions/new" element={<p>Add Transaction page</p>} /></Routes>
      </MemoryRouter>,
    )

    const quickAdd = screen.getByRole("link", { name: "Quick add transaction" })
    expect(quickAdd).toHaveAttribute("href", "/transactions/new")
    fireEvent.click(quickAdd)
    expect(screen.getByText("Add Transaction page")).toBeInTheDocument()
  })

  it("keeps the floating action separate and positioned above the edge bar", () => {
    render(<MemoryRouter initialEntries={["/dashboard"]}><MobileBottomNavigation /><MobileQuickAddButton /></MemoryRouter>)

    const navigation = screen.getByRole("navigation", { name: "Mobile navigation" })
    const quickAdd = screen.getByRole("link", { name: "Quick add transaction" })
    expect(navigation).not.toContainElement(quickAdd)
    expect(quickAdd.className).toContain("var(--mobile-navigation-height)")
    expect(quickAdd.className).toContain("env(safe-area-inset-bottom)")
  })
})
