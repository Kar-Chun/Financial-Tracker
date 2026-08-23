// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { rememberExpenseAccount } from "@/features/transactions/quick-add-preferences"
import { AddTransactionPage } from "@/features/transactions/add-transaction-page"
import type { SaveTransactionInput } from "@/features/transactions/transactions-service"
import type { AccountSummaryRow, Category } from "@/types/database"

const testData = vi.hoisted(() => ({
  bank: {
    id: "remembered-bank",
    name: "DBS Daily",
    account_type: "bank" as const,
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
  },
  categories: [
    { id: "food", user_id: "user-a", name: "Food", parent_id: null, category_type: "expense" as const, created_at: "2026-08-23T00:00:00Z", archived_at: null },
  ],
}))
const bank: AccountSummaryRow = testData.bank

vi.mock("@/features/auth/auth-context", () => ({ useAuth: () => ({ user: { id: "user-a" } }) }))
vi.mock("@/features/accounts/accounts-hooks", () => ({
  useAccounts: () => ({ data: [testData.bank], isLoading: false, isError: false }),
}))
vi.mock("@/features/auth/profile-service", () => ({
  useProfile: () => ({ data: { timezone: "Asia/Singapore" }, isLoading: false, isError: false }),
}))
vi.mock("@/features/transactions/transactions-hooks", () => ({
  useCategories: () => ({ data: testData.categories, isLoading: false, isError: false }),
  useFrequentExpenseCategories: () => ({ data: [{ category_id: "food", usage_count: 3, last_used_on: "2026-08-23" }] }),
}))
vi.mock("@/features/transactions/transaction-form", () => ({
  TransactionForm: (props: {
    entryPage?: boolean
    initialAccountId?: string | null
    frequentCategories?: Category[]
    onSaved?: (input: SaveTransactionInput) => void
  }) => (
    <div>
      <p>Page form: {String(props.entryPage)}</p>
      <p>Initial account: {props.initialAccountId}</p>
      <p>Frequent: {props.frequentCategories?.map((category) => category.name).join(", ")}</p>
      <button type="button" onClick={() => props.onSaved?.({
        transactionType: "expense",
        amountMinor: 500,
        accountId: testData.bank.id,
        categoryId: "food",
        transactionDate: "2026-08-23",
        description: "Caifan",
      })}>Simulate confirmed save</button>
    </div>
  ),
}))

beforeEach(() => {
  localStorage.clear()
  rememberExpenseAccount("user-a", bank.id)
})

describe("AddTransactionPage", () => {
  it("restores Quick Add conveniences and returns to the originating route after a confirmed save", () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: "/transactions/new", state: { returnTo: "/dashboard" } }]}>
        <Routes>
          <Route path="/transactions/new" element={<AddTransactionPage />} />
          <Route path="/dashboard" element={<p>Dashboard destination</p>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText("Page form: true")).toBeInTheDocument()
    expect(screen.getByText(`Initial account: ${bank.id}`)).toBeInTheDocument()
    expect(screen.getByText("Frequent: Food")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Simulate confirmed save" }))
    expect(screen.getByText("Dashboard destination")).toBeInTheDocument()
  })

  it("uses Transactions as the safe direct-entry Back destination", () => {
    render(
      <MemoryRouter initialEntries={["/transactions/new"]}>
        <Routes><Route path="/transactions/new" element={<AddTransactionPage />} /></Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole("link", { name: "Back to previous page" })).toHaveAttribute("href", "/transactions")
  })
})
