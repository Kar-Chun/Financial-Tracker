// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TransactionForm } from "@/features/transactions/transaction-form"
import type { SaveTransactionInput } from "@/features/transactions/transactions-service"
import type { AccountSummaryRow, Category } from "@/types/finance"
import type { TransactionRecord } from "@/types/finance"

const mutationState = vi.hoisted(() => ({
  isPending: false,
  mutate: vi.fn(),
}))

vi.mock("@/features/transactions/transactions-hooks", () => ({
  useSaveTransaction: () => mutationState,
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const bank = account("bank-account", "Daily Spending", "bank")
const cash = account("cash-account", "Cash Wallet", "cash")
const categories: Category[] = [
  category("food", "Food", "expense"),
  category("eating-out", "Eating Out", "expense", "food"),
  category("salary", "Salary", "income"),
]

beforeEach(() => {
  mutationState.isPending = false
  mutationState.mutate.mockReset()
  mutationState.mutate.mockImplementation((_input: SaveTransactionInput, options: { onSuccess: () => void }) => options.onSuccess())
})

describe("Add Transaction form", () => {
  it("defaults to Expense and keeps Note, date, readable categories, and account visible", () => {
    renderForm()

    expect(screen.getByRole("button", { name: "Expense" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("textbox", { name: "Note" })).toBeVisible()
    expect(screen.getByLabelText("Amount")).toHaveAttribute("inputmode", "decimal")
    expect(screen.getByLabelText("Amount")).toHaveClass("h-12")
    expect(screen.getByLabelText("Amount")).not.toHaveClass("h-24")
    expect(screen.getByLabelText("Date")).toHaveValue("2026-08-23")
    expect(screen.getByLabelText("Date")).toHaveAttribute("type", "date")
    expect(screen.getByLabelText("Date")).toHaveAttribute("data-transaction-date")
    expect(screen.getByLabelText("Date")).toHaveClass("w-full", "min-w-0", "max-w-full")
    expect(screen.getByRole("button", { name: "Food › Eating Out" })).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Account" })).toHaveTextContent("Daily Spending")
    expect(screen.queryByText("bank-account")).not.toBeInTheDocument()
  })

  it("switches between Income and Transfer fields without hiding Note", () => {
    renderForm()

    fireEvent.click(screen.getByRole("button", { name: "Income" }))
    expect(screen.getByRole("button", { name: "Income" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("combobox", { name: "Category" })).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Account" })).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Note" })).toBeVisible()

    fireEvent.click(screen.getByRole("button", { name: "Transfer" }))
    expect(screen.queryByRole("combobox", { name: "Category" })).not.toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "From account" })).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "To account" })).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Note" })).toBeVisible()
  })

  it("populates an existing description under the user-facing Note label", () => {
    renderForm({ transaction: existingExpense("Caifan"), entryPage: false })
    expect(screen.getByRole("textbox", { name: "Note" })).toHaveValue("Caifan")
    expect(screen.queryByText(/Description \(optional\)/)).not.toBeInTheDocument()
  })

  it("sends an expense Note through the existing description field", async () => {
    renderForm()
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "5.00" } })
    fireEvent.click(screen.getByRole("button", { name: "Food › Eating Out" }))
    fireEvent.change(screen.getByRole("textbox", { name: "Note" }), { target: { value: "Caifan" } })
    fireEvent.click(screen.getByRole("button", { name: "Save expense" }))

    await expectSaved({ transactionType: "expense", amountMinor: 500, categoryId: "eating-out", description: "Caifan" })
  })

  it("preserves an income Note in the same description field", async () => {
    renderForm()
    fireEvent.click(screen.getByRole("button", { name: "Income" }))
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "1000.00" } })
    await chooseOption("Category", "Salary")
    fireEvent.change(screen.getByRole("textbox", { name: "Note" }), { target: { value: "Internship salary" } })
    fireEvent.click(screen.getByRole("button", { name: "Save income" }))
    await expectSaved({ transactionType: "income", amountMinor: 100_000, categoryId: "salary", description: "Internship salary" })
  })

  it("disables the Save action while a write is pending", () => {
    mutationState.isPending = true
    renderForm()
    expect(screen.getByRole("button", { name: "Save expense" })).toBeDisabled()
  })
})

function renderForm({ transaction, entryPage = true }: { transaction?: TransactionRecord; entryPage?: boolean } = {}) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <TransactionForm
        entryPage={entryPage}
        accounts={[bank, cash]}
        categories={categories}
        transaction={transaction}
        initialAccountId={bank.id}
        initialDate="2026-08-23"
        frequentCategories={[categories[1]]}
        sessionKey="test"
        onCancel={vi.fn()}
      />
    </QueryClientProvider>,
  )
}

async function chooseOption(selectName: string, optionName: string) {
  fireEvent.click(screen.getByRole("combobox", { name: selectName }))
  fireEvent.click(await screen.findByRole("option", { name: new RegExp(optionName, "i") }))
}

async function expectSaved(expected: Partial<SaveTransactionInput>) {
  await waitFor(() => expect(mutationState.mutate).toHaveBeenCalledOnce())
  expect(mutationState.mutate.mock.calls[0][0]).toMatchObject(expected)
}

function account(id: string, name: string, accountType: AccountSummaryRow["account_type"]): AccountSummaryRow {
  return {
    id,
    name,
    account_type: accountType,
    institution: accountType === "bank" ? "DBS" : null,
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
}

function category(id: string, name: string, categoryType: Category["category_type"], parentId: string | null = null): Category {
  return {
    id,
    user_id: "user-a",
    name,
    parent_id: parentId,
    category_type: categoryType,
    created_at: "2026-08-23T00:00:00Z",
    archived_at: null,
  }
}

function existingExpense(description: string): TransactionRecord {
  return {
    id: "expense-id",
    transaction_type: "expense",
    category_id: "eating-out",
    description,
    transaction_date: "2026-08-23",
    created_at: "2026-08-23T00:00:00Z",
    category: { id: "eating-out", name: "Eating Out", parent_id: "food", category_type: "expense" },
    entries: [{
      id: "entry-id",
      account_id: bank.id,
      amount_minor: -500,
      account: { id: bank.id, name: bank.name, currency_code: "SGD", account_type: "bank" },
    }],
  }
}
