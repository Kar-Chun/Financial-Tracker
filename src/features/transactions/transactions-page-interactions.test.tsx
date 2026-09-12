// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TransactionsPage } from "@/features/transactions/transactions-page"
import type { TransactionRecord } from "@/types/finance"

const hooks = vi.hoisted(() => ({ transactions: vi.fn(), more: vi.fn(), remove: vi.fn() }))
vi.mock("@/features/auth/auth-context", () => ({ useAuth: () => ({ user: { id: "user-a" } }) }))
vi.mock("@/features/accounts/accounts-hooks", () => ({ useAccounts: () => ({ data: [{ id: "bank", name: "Daily bank" }] }) }))
vi.mock("@/features/transactions/transactions-hooks", () => ({
  useTransactions: hooks.transactions,
  useSoftDeleteTransaction: () => ({ mutate: hooks.remove }),
  useCategories: () => ({ data: [{ id: "food", name: "Food", parent_id: null, category_type: "expense" }, { id: "old", name: "Old category", parent_id: null, category_type: "expense", archived_at: "2026-01-01" }] }),
}))
vi.mock("@/features/transactions/transaction-form-dialog", () => ({
  TransactionFormDialog: ({ open, transaction }: { open: boolean; transaction: TransactionRecord | null }) => open ? <div role="dialog" aria-label="Edit transaction">{transaction?.description}</div> : null,
}))

const transaction: TransactionRecord = {
  id: "one", transaction_type: "expense", category_id: "food", description: "Lunch note", transaction_date: "2026-09-09", created_at: "2026-09-09T01:00:00Z",
  category: { id: "food", name: "Food", parent_id: null, category_type: "expense" },
  entries: [{ id: "entry", account_id: "bank", amount_minor: -500, account: { id: "bank", name: "Daily bank", account_type: "bank", currency_code: "SGD" } }],
}

beforeEach(() => {
  hooks.transactions.mockReset().mockReturnValue({ data: { pages: [{ items: [transaction], next_cursor: null }] }, hasNextPage: true, isFetchingNextPage: false, fetchNextPage: hooks.more })
  hooks.more.mockReset()
})

function openPage(url = "/transactions") {
  return render(<MemoryRouter initialEntries={[url]}><TransactionsPage /></MemoryRouter>)
}

describe("refreshed transaction controls", () => {
  it.each(["expense", "income", "transfer"])("passes the %s pill through to server filters", (type) => {
    openPage()
    fireEvent.click(screen.getByRole("button", { name: type[0].toUpperCase() + type.slice(1) }))
    expect(hooks.transactions).toHaveBeenLastCalledWith(expect.objectContaining({ transactionType: type }), "user-a")
    fireEvent.click(screen.getByRole("button", { name: "All" }))
    expect(hooks.transactions).toHaveBeenLastCalledWith(expect.objectContaining({ transactionType: null }), "user-a")
  })

  it("retains month, account and archived category filters", async () => {
    openPage()
    fireEvent.change(screen.getByLabelText("Filter month"), { target: { value: "2026-08" } })
    expect(hooks.transactions).toHaveBeenLastCalledWith(expect.objectContaining({ startDate: "2026-08-01", endDate: "2026-08-31" }), "user-a")
    fireEvent.click(screen.getByRole("combobox", { name: "All accounts" }))
    const bank = await screen.findByRole("option", { name: "Daily bank" })
    fireEvent.pointerDown(bank, { pointerType: "mouse" })
    fireEvent.click(bank)
    expect(hooks.transactions).toHaveBeenLastCalledWith(expect.objectContaining({ accountId: "bank" }), "user-a")
    fireEvent.click(screen.getByRole("combobox", { name: "All categories" }))
    const category = await screen.findByRole("option", { name: "Old category (Archived)" })
    fireEvent.pointerDown(category, { pointerType: "mouse" })
    fireEvent.click(category)
    expect(hooks.transactions).toHaveBeenLastCalledWith(expect.objectContaining({ categoryId: "old", accountId: "bank" }), "user-a")
  })

  it("keeps the exact eligible day drilldown and clears it with Show full month", () => {
    openPage("/transactions?date=2026-09-09&type=expense&eligible=true")
    expect(hooks.transactions).toHaveBeenLastCalledWith(expect.objectContaining({ startDate: "2026-09-09", endDate: "2026-09-09", eligibleSpending: true, transactionType: "expense" }), "user-a")
    fireEvent.click(screen.getByRole("button", { name: "Show full month" }))
    expect(hooks.transactions).toHaveBeenLastCalledWith(expect.objectContaining({ startDate: "2026-09-01", endDate: "2026-09-30", eligibleSpending: false }), "user-a")
  })

  it("loads more with the existing query and groups deduplicated rows without partial day totals", () => {
    hooks.transactions.mockReturnValue({ data: { pages: [{ items: [transaction], next_cursor: null }, { items: [transaction, { ...transaction, id: "two", description: "Second note" }], next_cursor: null }] }, hasNextPage: true, fetchNextPage: hooks.more })
    openPage()
    expect(screen.getAllByText("Lunch note")).toHaveLength(1)
    expect(screen.getByText("Second note")).toBeInTheDocument()
    expect(screen.getAllByRole("heading", { name: "9 Sept 2026" })).toHaveLength(1)
    fireEvent.click(screen.getByRole("button", { name: "Load more" }))
    expect(hooks.more).toHaveBeenCalledOnce()
  })

  it("opens the same edit dialog from a ledger row", () => {
    openPage()
    fireEvent.click(screen.getByRole("button", { name: "Edit expense transaction" }))
    expect(screen.getByRole("dialog", { name: "Edit transaction" })).toHaveTextContent("Lunch note")
  })
})
