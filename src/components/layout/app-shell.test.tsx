// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { AppShell } from "@/components/layout/app-shell"

vi.mock("@/components/layout/app-sidebar", () => ({ AppSidebar: () => null }))
vi.mock("@/components/layout/mobile-header", () => ({ MobileHeader: () => null }))
vi.mock("@/components/layout/user-menu", () => ({ UserMenu: () => null }))
vi.mock("@/features/transactions/quick-add-sheet", () => ({
  QuickAddSheet: ({ open }: { open: boolean }) => open ? <div role="dialog">Quick Add sheet</div> : null,
}))

describe("AppShell mobile Quick Add", () => {
  it("opens the existing Quick Add sheet from the floating action and hides the duplicate action", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<div>Dashboard content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Quick add transaction" }))

    expect(screen.getByRole("dialog")).toHaveTextContent("Quick Add sheet")
    expect(screen.queryByRole("button", { name: "Quick add transaction" })).not.toBeInTheDocument()
  })
})
