// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { SettingsPage } from "@/features/settings/settings-page"

const mocks = vi.hoisted(() => ({ saveProfile: vi.fn(), saveCategory: vi.fn(), resetHistory: vi.fn(), profile: { id: "owner", display_name: "Alex", base_currency: "SGD", timezone: "Asia/Singapore" } }))
vi.mock("@/features/auth/auth-context", () => ({ useAuth: () => ({ user: { id: "owner" } }) }))
vi.mock("@/features/auth/profile-service", () => ({
  useProfile: () => ({ data: mocks.profile }),
  useUpdateProfile: () => ({ mutate: mocks.saveProfile, isPending: false }),
}))
vi.mock("@/features/transactions/transactions-hooks", () => ({ useCategories: () => ({ data: [] }) }))
vi.mock("@/features/categories/categories-hooks", () => ({
  useSaveCategory: () => ({ mutate: mocks.saveCategory, isPending: false }),
  useSetCategoryArchived: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock("@/features/settings/net-worth-history-hooks", () => ({ useResetNetWorthHistory: () => ({ mutate: mocks.resetHistory, isPending: false }) }))
vi.mock("@/lib/pwa-install", () => ({ usePwaInstall: () => ({ canInstall: false, isIos: true, isStandalone: false }) }))

beforeEach(() => vi.clearAllMocks())

describe("Settings refreshed sections", () => {
  it("preserves editable profile fields and the locked currency", async () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument()
    expect(screen.getByLabelText("Base currency")).toBeDisabled()
    expect(screen.getByLabelText("Timezone")).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Alex Tan" } })
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }))
    await waitFor(() => expect(mocks.saveProfile).toHaveBeenCalledWith({ displayName: "Alex Tan", timezone: "Asia/Singapore" }, expect.any(Object)))
    expect(screen.getByText("Add to Home Screen")).toBeInTheDocument()
  })

  it("keeps category type pills and category creation wired to the existing mutation", async () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole("button", { name: "Income Categories" }))
    expect(screen.getByRole("button", { name: "Income Categories" })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(screen.getByRole("button", { name: "Add Category" }))
    const dialog = within(screen.getByRole("dialog"))
    fireEvent.change(dialog.getByLabelText("Name"), { target: { value: "Allowance" } })
    fireEvent.click(dialog.getByRole("button", { name: "Create category" }))
    await waitFor(() => expect(mocks.saveCategory).toHaveBeenCalledWith(expect.objectContaining({ name: "Allowance", categoryType: "income", parentId: null }), expect.any(Object)))
  })

  it("keeps history reset behind typed destructive confirmation", () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole("button", { name: "Reset history" }))
    const dialog = within(screen.getByRole("alertdialog"))
    expect(dialog.getByRole("button", { name: "Reset history" })).toBeDisabled()
    fireEvent.change(dialog.getByLabelText("Type RESET to confirm Net Worth history reset"), { target: { value: "RESET" } })
    fireEvent.click(dialog.getByRole("button", { name: "Reset history" }))
    expect(mocks.resetHistory).toHaveBeenCalledTimes(1)
  })
})
