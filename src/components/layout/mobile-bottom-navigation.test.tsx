// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
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
    expect(screen.getByRole("navigation", { name: "Mobile navigation" }).querySelectorAll(":scope > div > *")).toHaveLength(4)
    expect(screen.queryByRole("button", { name: "Quick add transaction" })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "More navigation options" }))
    expect(screen.getByRole("link", { name: /Accounts/ })).toHaveAttribute("href", "/accounts")
    expect(screen.getByRole("link", { name: /Investments/ })).toHaveAttribute("href", "/investments")
    expect(screen.getByRole("link", { name: /Settings/ })).toHaveAttribute("href", "/settings")
  })

  it("opens Quick Add from the separate floating action", () => {
    const onQuickAdd = vi.fn()
    render(<MobileQuickAddButton onQuickAdd={onQuickAdd} />)
    fireEvent.click(screen.getByRole("button", { name: "Quick add transaction" }))
    expect(onQuickAdd).toHaveBeenCalledOnce()
  })
})
