// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { TransactionForm } from "@/features/transactions/transaction-form"
import type { AccountSummaryRow, Category } from "@/types/database"

const account: AccountSummaryRow = {
  id: "account-uuid",
  name: "Daily Spending",
  account_type: "bank",
  institution: "DBS",
  currency_code: "SGD",
  opening_balance_minor: 0,
  current_balance_minor: 0,
  native_value_minor: null,
  base_value_minor: null,
  valued_at: null,
  included_in_net_worth: true,
  created_at: "2026-08-23T00:00:00Z",
  updated_at: "2026-08-23T00:00:00Z",
}

const categories: Category[] = [
  { id: "food", user_id: "user-a", name: "Food", parent_id: null, category_type: "expense", created_at: "2026-08-23T00:00:00Z", archived_at: null },
  { id: "eating-out-uuid", user_id: "user-a", name: "Eating Out", parent_id: "food", category_type: "expense", created_at: "2026-08-23T00:00:00Z", archived_at: null },
]

describe("Quick Add transaction form", () => {
  it("shows readable account and contextual category labels instead of IDs", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <TransactionForm
          quickAdd
          accounts={[account]}
          categories={categories}
          initialAccountId={account.id}
          frequentCategories={[categories[1]]}
          sessionKey="test"
          onCancel={vi.fn()}
        />
      </QueryClientProvider>,
    )

    expect(screen.getByText("Daily Spending")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Food › Eating Out" })).toBeInTheDocument()
    expect(screen.queryByText("account-uuid")).not.toBeInTheDocument()
    expect(screen.queryByText("eating-out-uuid")).not.toBeInTheDocument()
  })
})
