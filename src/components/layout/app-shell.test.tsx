// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { AppShell } from "@/components/layout/app-shell"

vi.mock("@/components/layout/app-sidebar", () => ({ AppSidebar: () => null }))
vi.mock("@/components/layout/mobile-header", () => ({ MobileHeader: () => null }))
vi.mock("@/components/layout/user-menu", () => ({ UserMenu: () => null }))
describe("AppShell transaction entry route", () => {
  it("uses the dedicated page without rendering navigation or another floating action over it", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<div>Dashboard content</div>} />
            <Route path="/transactions/new" element={<div>Add Transaction content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole("link", { name: "Quick add transaction" }))

    expect(screen.getByText("Add Transaction content")).toBeInTheDocument()
    expect(screen.queryByRole("navigation", { name: "Mobile navigation" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Quick add transaction" })).not.toBeInTheDocument()
  })
})
