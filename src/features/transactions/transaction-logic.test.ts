import { describe, expect, it } from "vitest"

import {
  buildEntryAmounts,
  calculateNetCashFlow,
  transactionFormSchema,
  transferPreservesNetWorth,
  validateTransactionDraft,
} from "@/features/transactions/transaction-logic"
import type { AccountSummaryRow } from "@/types/database"
import type { TransactionRecord } from "@/types/finance"

const sgdAccount = account("sgd", "SGD")
const usdAccount = account("usd", "USD")
const secondSgdAccount = account("cash", "SGD")

describe("transaction signs and validation", () => {
  it("uses a negative entry for expenses and a positive entry for income", () => {
    expect(buildEntryAmounts("expense", 800)).toEqual([-800])
    expect(buildEntryAmounts("income", 100_000)).toEqual([100_000])
  })

  it("creates opposite transfer entries that preserve net worth", () => {
    expect(buildEntryAmounts("transfer", 30_000)).toEqual([-30_000, 30_000])
    expect(transferPreservesNetWorth(30_000)).toBe(true)
  })

  it("requires categories for expense and income forms", () => {
    const result = transactionFormSchema.safeParse({
      transactionType: "expense",
      amount: "8.00",
      accountId: "sgd",
      destinationAccountId: "",
      categoryId: "",
      transactionDate: "2026-08-22",
      description: "Lunch",
    })
    expect(result.success).toBe(false)
  })

  it("rejects cross-currency transfers", () => {
    const draft = transactionFormSchema.parse({
      transactionType: "transfer",
      amount: "100.00",
      accountId: "sgd",
      destinationAccountId: "usd",
      categoryId: "",
      transactionDate: "2026-08-22",
      description: "",
    })
    expect(() => validateTransactionDraft(draft, [sgdAccount, usdAccount])).toThrow("Cross-currency")
  })

  it("accepts a same-currency transfer", () => {
    const draft = transactionFormSchema.parse({
      transactionType: "transfer",
      amount: "300.00",
      accountId: "sgd",
      destinationAccountId: "cash",
      categoryId: "",
      transactionDate: "2026-08-22",
      description: "ATM withdrawal",
    })
    expect(validateTransactionDraft(draft, [sgdAccount, secondSgdAccount]).amountMinor).toBe(30_000)
  })

  it("excludes transfers and reserved types from net cash flow", () => {
    const records = [
      transaction("income", 100_000),
      transaction("expense", -800),
      transaction("transfer", -30_000, 30_000),
      transaction("refund", 500),
      transaction("adjustment", 1_000),
    ]
    expect(calculateNetCashFlow(records)).toBe(99_200)
  })
})

function account(id: string, currencyCode: string): AccountSummaryRow {
  return {
    id,
    name: id,
    account_type: "bank",
    institution: null,
    currency_code: currencyCode,
    opening_balance_minor: 0,
    current_balance_minor: 0,
    native_value_minor: null,
    base_value_minor: null,
    valued_at: null,
    included_in_net_worth: currencyCode === "SGD",
    created_at: "2026-08-22T00:00:00Z",
    updated_at: "2026-08-22T00:00:00Z",
  }
}

function transaction(type: TransactionRecord["transaction_type"], ...amounts: number[]): TransactionRecord {
  return {
    id: `${type}-${amounts.join("-")}`,
    transaction_type: type,
    category_id: null,
    description: null,
    transaction_date: "2026-08-22",
    created_at: "2026-08-22T00:00:00Z",
    category: null,
    entries: amounts.map((amount, index) => ({
      id: `${type}-${index}`,
      account_id: index === 0 ? "sgd" : "cash",
      amount_minor: amount,
      account: {
        id: index === 0 ? "sgd" : "cash",
        name: "Account",
        currency_code: "SGD",
        account_type: "bank",
      },
    })),
  }
}
