// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { InvestmentsPage } from "@/features/investments/investments-page"

vi.mock("@/features/investments/investments-hooks", () => ({
  useInvestmentPortfolio: () => ({
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    data: {
      accounts: [],
      currency_code: "SGD",
      portfolio_value_base_minor: 0,
      unrealized_gain_base_minor: 0,
      excluded_account_count: 0,
    },
  }),
}))

vi.mock("@/features/accounts/accounts-hooks", () => ({
  useSaveAccount: () => ({ mutate: vi.fn(), isPending: false }),
  useSaveInvestmentValuation: () => ({ mutate: vi.fn(), isPending: false }),
  useArchiveAccount: () => ({ mutate: vi.fn(), isPending: false }),
  useRestoreAccount: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteAccountPermanently: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock("@/features/auth/profile-service", () => ({
  useProfile: () => ({ data: { base_currency: "SGD", timezone: "Asia/Singapore" } }),
}))

describe("investments empty state", () => {
  it("renders a clean creation path after the only test account is deleted", () => {
    render(<MemoryRouter><InvestmentsPage /></MemoryRouter>)

    expect(screen.getByRole("heading", { name: "No investment accounts yet" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add investment account" })).toBeInTheDocument()
  })
})
