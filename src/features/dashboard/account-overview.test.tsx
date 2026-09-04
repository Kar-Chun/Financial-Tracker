// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { AccountOverview } from "@/features/dashboard/account-overview"
import type { AccountSummaryRow } from "@/types/finance"

function account(overrides: Partial<AccountSummaryRow>): AccountSummaryRow {
  return {
    id: "account-id",
    name: "Account",
    account_type: "bank",
    institution: null,
    currency_code: "SGD",
    opening_balance_minor: 0,
    current_balance_minor: 0,
    native_value_minor: null,
    base_value_minor: null,
    valued_at: null,
    included_in_net_worth: true,
    created_at: "2026-08-23T00:00:00Z",
    updated_at: "2026-08-23T00:00:00Z",
    ...overrides,
  }
}

describe("AccountOverview", () => {
  it("keeps long account labels readable and formats large values at currency precision", () => {
    render(
      <MemoryRouter>
        <AccountOverview
          baseCurrency="SGD"
          accounts={[
            account({
              name: "DBS Multiplier Savings Account",
              current_balance_minor: 1_234_567,
            }),
            account({
              id: "investment-id",
              name: "Interactive Brokers Investment",
              account_type: "investment",
              currency_code: "USD",
              base_value_minor: 12_345_678,
            }),
          ]}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText("DBS Multiplier Savings Account")).toBeInTheDocument()
    expect(screen.getByText("$12,345.67")).toBeInTheDocument()
    expect(screen.getByText("Interactive Brokers Investment")).toBeInTheDocument()
    expect(screen.getByText("$123,456.78")).toBeInTheDocument()
  })
})
