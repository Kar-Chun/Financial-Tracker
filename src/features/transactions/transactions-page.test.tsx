// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { TransactionRow } from "@/features/transactions/transactions-page"
import type { TransactionRecord } from "@/types/finance"

describe("Transactions page rows", () => {
  it("uses Note as the title while retaining category and account context", () => {
    render(<TransactionRow transaction={expense("Caifan")} bordered={false} onEdit={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByText("Caifan")).toBeInTheDocument()
    expect(screen.getByText("Food · Daily Spending · 23 Aug 2026")).toBeInTheDocument()
    expect(screen.getByText((_, element) => element?.tagName === "P" && element.textContent === "expense: -$5.00")).toBeInTheDocument()
  })

  it("falls back to the category when Note is empty without losing account context", () => {
    render(<TransactionRow transaction={expense(null)} bordered={false} onEdit={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByText("Food")).toBeInTheDocument()
    expect(screen.getByText("Daily Spending · 23 Aug 2026")).toBeInTheDocument()
  })
})

function expense(description: string | null): TransactionRecord {
  return {
    id: description ?? "empty-note",
    transaction_type: "expense",
    category_id: "food",
    description,
    transaction_date: "2026-08-23",
    created_at: "2026-08-23T00:00:00Z",
    category: { id: "food", name: "Food", parent_id: null, category_type: "expense" },
    entries: [{
      id: "entry-id",
      account_id: "bank-id",
      amount_minor: -500,
      account: { id: "bank-id", name: "Daily Spending", currency_code: "SGD", account_type: "bank" },
    }],
  }
}
