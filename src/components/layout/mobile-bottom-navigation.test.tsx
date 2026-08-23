// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { MobileBottomNavigation } from "@/components/layout/mobile-bottom-navigation"

vi.mock("@/components/layout/user-menu", () => ({ UserMenu: () => <div>User menu</div> }))

describe("mobile bottom navigation", () => {
  it("links to primary routes and opens Quick Add", () => {
    const onQuickAdd = vi.fn()
    render(<MemoryRouter initialEntries={["/dashboard"]}><MobileBottomNavigation onQuickAdd={onQuickAdd} /></MemoryRouter>)

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard")
    expect(screen.getByRole("link", { name: "Transactions" })).toHaveAttribute("href", "/transactions")
    expect(screen.getByRole("link", { name: "Analytics" })).toHaveAttribute("href", "/analytics")
    fireEvent.click(screen.getByRole("button", { name: "Quick add transaction" }))
    expect(onQuickAdd).toHaveBeenCalledOnce()
  })
})
