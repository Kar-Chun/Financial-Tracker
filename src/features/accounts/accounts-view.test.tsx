// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AccountsView } from "@/features/accounts/accounts-view"

const mocks = vi.hoisted(() => ({
  archive: vi.fn(),
  restore: vi.fn(),
  remove: vi.fn(),
}))

vi.mock("@/features/accounts/accounts-hooks", () => ({
  useAccounts: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useArchivedAccounts: () => ({
    data: [{
      id: "test-ibkr",
      name: "Test IBKR",
      account_type: "investment",
      institution: "IBKR",
      currency_code: "USD",
      opening_balance_minor: 0,
      archived_at: "2026-08-27T00:00:00Z",
      investment_tracking_mode: "detailed",
      detailed_started_on: "2026-08-01",
    }],
    isLoading: false,
    isError: false,
  }),
  useArchiveAccount: () => ({ mutate: mocks.archive, isPending: false }),
  useRestoreAccount: () => ({ mutate: mocks.restore, isPending: false }),
  useDeleteAccountPermanently: () => ({ mutate: mocks.remove, isPending: false }),
  useSaveAccount: () => ({ mutate: vi.fn(), isPending: false }),
  useSaveInvestmentValuation: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock("@/features/auth/profile-service", () => ({
  useProfile: () => ({ data: { base_currency: "SGD" } }),
}))

beforeEach(() => {
  mocks.archive.mockReset()
  mocks.restore.mockReset()
  mocks.remove.mockReset()
})

describe("archived account management", () => {
  it("keeps archived accounts discoverable with restore and deliberate delete actions", () => {
    render(<MemoryRouter><AccountsView /></MemoryRouter>)

    expect(screen.getByRole("heading", { name: "Archived accounts" })).toBeInTheDocument()
    expect(screen.getByText("Test IBKR")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /restore/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /delete permanently/i }))
    const confirmation = screen.getByLabelText("Type DELETE to confirm permanent account deletion")
    const deleteAction = screen.getAllByRole("button", { name: "Delete permanently" }).at(-1)!
    expect(deleteAction).toBeDisabled()

    fireEvent.change(confirmation, { target: { value: "DELETE" } })
    expect(deleteAction).toBeEnabled()
    fireEvent.click(deleteAction)

    expect(mocks.remove).toHaveBeenCalledTimes(1)
    expect(mocks.remove).toHaveBeenCalledWith("test-ibkr", expect.any(Object))
  })
})
