// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { UserMenu } from "@/components/layout/user-menu"
import { signOut } from "@/features/auth/auth-service"
import { SettingsPage } from "@/features/settings/settings-page"

const mockValues = vi.hoisted(() => ({
  profile: { id: "user-a", display_name: "Alex Rivera", base_currency: "SGD", timezone: "Asia/Singapore" },
  profileMutation: { mutate: vi.fn(), isPending: false },
}))

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => ({ user: { id: "user-a", email: "user@example.com" } }),
}))
vi.mock("@/features/auth/profile-service", () => ({
  useProfile: () => ({ data: mockValues.profile }),
  useUpdateProfile: () => mockValues.profileMutation,
}))
vi.mock("@/features/auth/auth-service", () => ({ signOut: vi.fn() }))
vi.mock("@/features/categories/category-management", () => ({ CategoryManagement: () => <section>Category management</section> }))
vi.mock("@/components/shared/pwa-install-card", () => ({ PwaInstallCard: () => <section>PWA installation</section> }))

describe("UserMenu", () => {
  beforeEach(() => vi.mocked(signOut).mockReset())

  it("opens from the signed-in avatar, exposes logout, and reaches Settings", async () => {
    renderUserMenu()

    fireEvent.click(screen.getByRole("button", { name: "Open user menu" }))
    expect(await screen.findByText("Personal workspace")).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "Sign out" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("menuitem", { name: "Settings" }))
    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument()
    expect(screen.getByText("Category management")).toBeInTheDocument()
  })

  it("signs out, clears sensitive queries, and removes the protected destination", async () => {
    vi.mocked(signOut).mockResolvedValue()
    const queryClient = renderUserMenu()
    queryClient.setQueryData(["dashboard"], { netWorth: 100_000 })

    fireEvent.click(screen.getByRole("button", { name: "Open user menu" }))
    fireEvent.click(await screen.findByRole("menuitem", { name: "Sign out" }))

    expect(await screen.findByText("Login destination")).toBeInTheDocument()
    expect(queryClient.getQueryData(["dashboard"])).toBeUndefined()
    expect(signOut).toHaveBeenCalledTimes(1)
  })
})

function renderUserMenu() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/dashboard"]}>
        <UserMenu compact />
        <Routes>
          <Route path="/dashboard" element={null} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/login" element={<p>Login destination</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return queryClient
}
