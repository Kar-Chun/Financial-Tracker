// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { AccountDetailDialog } from "@/features/accounts/account-detail-dialog"
import { TransactionRow } from "@/features/transactions/transactions-page"
import type { AccountSummaryRow, TransactionRecord } from "@/types/finance"

const mocks = vi.hoisted(() => ({ mutateAsync: vi.fn(), refetch: vi.fn(), pending: false, online: true }))
vi.mock("@/features/accounts/accounts-hooks", () => ({
  useAccounts: () => ({ refetch: mocks.refetch }),
  useReconcileAccount: () => ({ mutateAsync: mocks.mutateAsync, isPending: mocks.pending }),
}))
vi.mock("@/hooks/use-online-status", () => ({ useOnlineStatus: () => mocks.online }))
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }))

const account: AccountSummaryRow = {
  id: "bank", name: "Savings", account_type: "bank", institution: null, currency_code: "SGD",
  opening_balance_minor: 100000, current_balance_minor: 100000, native_value_minor: null,
  base_value_minor: null, valued_at: null, included_in_net_worth: true, created_at: "", updated_at: "",
}
beforeEach(() => {
  mocks.mutateAsync.mockReset().mockResolvedValue({ transaction_id: "adjustment", balance_minor: 95000, adjustment_minor: -5000 })
  mocks.refetch.mockReset().mockResolvedValue({ data: [account] })
  mocks.pending = false
  mocks.online = true
})
function openForm(override = account, onClose = vi.fn()) {
  render(<AccountDetailDialog account={override} onClose={onClose} />)
  fireEvent.click(screen.getByRole("button", { name: "Reconcile balance" }))
  return onClose
}

describe("account reconciliation", () => {
  it.each([
    [100000, "950", "-$50.00", 95000],
    [95000, "1000", "+$50.00", 100000],
    [100000, "-5.25", "-$1,005.25", -525],
  ])("previews exact signed differences and submits actual plus reviewed balance", async (balance, actual, difference, actualMinor) => {
    const onClose = openForm({ ...account, current_balance_minor: balance })
    fireEvent.change(screen.getByLabelText("Actual balance (SGD)"), { target: { value: actual } })
    fireEvent.change(screen.getByLabelText("Note (optional)"), { target: { value: "Missing bank transactions" } })
    expect(screen.getByText(difference)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Reconcile balance" }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      accountId: "bank", expectedCurrentBalanceMinor: balance, actualBalanceMinor: actualMinor,
      expectedCurrencyCode: "SGD", note: "Missing bank transactions",
    })
  })

  it("does not submit a matching or malformed amount", () => {
    openForm()
    fireEvent.change(screen.getByLabelText("Actual balance (SGD)"), { target: { value: "1000.00" } })
    expect(screen.getByText("Balances already match.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Reconcile balance" })).toBeDisabled()
    fireEvent.change(screen.getByLabelText("Actual balance (SGD)"), { target: { value: "950.001" } })
    expect(screen.getByRole("button", { name: "Reconcile balance" })).toBeDisabled()
    expect(mocks.mutateAsync).not.toHaveBeenCalled()
  })

  it("blocks offline submissions without losing the form", () => {
    mocks.online = false
    openForm()
    fireEvent.change(screen.getByLabelText("Actual balance (SGD)"), { target: { value: "950" } })
    expect(screen.getByRole("status")).toHaveTextContent("You're offline")
    expect(screen.getByRole("button", { name: "Reconcile balance" })).toBeDisabled()
    expect(screen.getByLabelText("Actual balance (SGD)")).toHaveValue("950")
  })

  it("prevents duplicate submissions even before a pending render", async () => {
    mocks.mutateAsync.mockReturnValue(new Promise(() => undefined))
    openForm()
    fireEvent.change(screen.getByLabelText("Actual balance (SGD)"), { target: { value: "950" } })
    const submit = screen.getByRole("button", { name: "Reconcile balance" })
    fireEvent.click(submit)
    fireEvent.click(submit)
    expect(mocks.mutateAsync).toHaveBeenCalledTimes(1)
  })

  it("refetches a stale balance and keeps the actual input for explicit review", async () => {
    mocks.mutateAsync.mockRejectedValue({ code: "40001", message: "Account balance changed." })
    mocks.refetch.mockResolvedValue({ data: [{ ...account, current_balance_minor: 99000 }] })
    const onClose = openForm()
    fireEvent.change(screen.getByLabelText("Actual balance (SGD)"), { target: { value: "950" } })
    fireEvent.click(screen.getByRole("button", { name: "Reconcile balance" }))
    await waitFor(() => expect(screen.getByText("-$40.00")).toBeInTheDocument())
    expect(screen.getByRole("alert")).toHaveTextContent("Review the updated balance")
    expect(screen.getByLabelText("Actual balance (SGD)")).toHaveValue("950")
    expect(onClose).not.toHaveBeenCalled()
  })

  it("does not expose reconciliation for investments", () => {
    render(<AccountDetailDialog account={{ ...account, account_type: "investment" }} onClose={vi.fn()} />)
    expect(screen.queryByRole("button", { name: "Reconcile balance" })).not.toBeInTheDocument()
  })

  it("uses the account's native currency for a Cash reconciliation", async () => {
    openForm({ ...account, account_type: "cash", currency_code: "USD", current_balance_minor: 12040, included_in_net_worth: false })
    fireEvent.change(screen.getByLabelText("Actual balance (USD)"), { target: { value: "115.20" } })
    fireEvent.click(screen.getByRole("button", { name: "Reconcile balance" }))
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledWith({
      accountId: "bank", expectedCurrentBalanceMinor: 12040, actualBalanceMinor: 11520,
      expectedCurrencyCode: "USD", note: "",
    }))
  })

  it("keeps confirmation blocked when the balance cannot be refreshed after an uncertain failure", async () => {
    mocks.mutateAsync.mockRejectedValue(new Error("Network unavailable"))
    mocks.refetch.mockResolvedValue({ data: undefined, isError: true })
    openForm()
    fireEvent.change(screen.getByLabelText("Actual balance (SGD)"), { target: { value: "950" } })
    fireEvent.click(screen.getByRole("button", { name: "Reconcile balance" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Refresh balance" })).toBeInTheDocument())
    expect(screen.getByRole("button", { name: "Reconcile balance" })).toBeDisabled()
    expect(mocks.mutateAsync).toHaveBeenCalledTimes(1)
  })

  it.each([-1350, 5000])("renders adjustment history with its signed native amount and no edit/delete controls", (amount) => {
    const transaction: TransactionRecord = {
      id: "adjustment", transaction_type: "adjustment", description: null, category_id: null, category: null,
      transaction_date: "2026-09-13", created_at: "", entries: [{
        id: "entry", account_id: "bank", amount_minor: amount,
        account: { id: "bank", name: "Savings", account_type: "bank", currency_code: "SGD" },
      }],
    }
    render(<TransactionRow transaction={transaction} bordered={false} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText("Balance adjustment")).toBeInTheDocument()
    expect(screen.getByText(/Reconciliation · Savings/)).toBeInTheDocument()
    expect(screen.getByText(amount < 0 ? "-$13.50" : "+$50.00")).toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })
})
