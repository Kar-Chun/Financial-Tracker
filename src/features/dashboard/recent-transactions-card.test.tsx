// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { RecentTransactionsCard } from "@/features/dashboard/recent-transactions-card"
import type { TransactionRecord } from "@/types/finance"

describe("RecentTransactionsCard", () => {
  it("renders readable, signed expense and transfer information without internal IDs", () => {
    render(
      <MemoryRouter>
        <RecentTransactionsCard transactions={[expense("Caifan"), expense(null, "empty-expense"), transfer()]} todayDate="2026-08-23" />
      </MemoryRouter>,
    )

    expect(screen.getByText("Caifan")).toBeInTheDocument()
    expect(screen.getByText("Eating Out · DBS Savings · Today")).toBeInTheDocument()
    expect(screen.getByText("Eating Out")).toBeInTheDocument()
    expect(screen.getByText("DBS Savings · Today")).toBeInTheDocument()
    expect(screen.getAllByText((_, element) => element?.tagName === "SPAN" && element.textContent === "expense: -$8.50")).toHaveLength(2)
    expect(screen.getByText("DBS Savings → Cash Wallet")).toBeInTheDocument()
    expect(screen.getByText("Transfer · Today")).toBeInTheDocument()
    expect(screen.getByText((_, element) => element?.tagName === "SPAN" && element.textContent === "transfer: $200.00")).toBeInTheDocument()
    expect(screen.queryByText("account-source-id")).not.toBeInTheDocument()
  })
})

function expense(description: string | null, id = "expense-id"): TransactionRecord {
  return {
    id,
    transaction_type: "expense",
    category_id: "category-id",
    description,
    transaction_date: "2026-08-23",
    created_at: "2026-08-23T00:00:00Z",
    category: { id: "category-id", name: "Eating Out", parent_id: "food-id", category_type: "expense" },
    entries: [{
      id: "entry-id",
      account_id: "account-source-id",
      amount_minor: -850,
      account: { id: "account-source-id", name: "DBS Savings", currency_code: "SGD", account_type: "bank" },
    }],
  }
}

function transfer(): TransactionRecord {
  return {
    id: "transfer-id",
    transaction_type: "transfer",
    category_id: null,
    description: null,
    transaction_date: "2026-08-23",
    created_at: "2026-08-23T00:00:00Z",
    category: null,
    entries: [
      { id: "source-entry", account_id: "account-source-id", amount_minor: -20_000, account: { id: "account-source-id", name: "DBS Savings", currency_code: "SGD", account_type: "bank" } },
      { id: "destination-entry", account_id: "account-destination-id", amount_minor: 20_000, account: { id: "account-destination-id", name: "Cash Wallet", currency_code: "SGD", account_type: "cash" } },
    ],
  }
}
