import { describe, expect, it } from "vitest"

import {
  getCategoryDisplayName,
  transactionFormSchema,
  validateTransactionDraft,
} from "@/features/transactions/transaction-logic"
import type { AccountSummaryRow } from "@/types/finance"

const sgdAccount = account("sgd", "SGD")
const usdAccount = account("usd", "USD")
const secondSgdAccount = account("cash", "SGD")

describe("transaction draft validation", () => {
  it("formats subcategories with their parent context", () => {
    const categories = [
      category("food", "Food", null),
      category("eating-out", "Eating Out", "food"),
    ]
    expect(getCategoryDisplayName(categories[1], categories)).toBe("Food › Eating Out")
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

function category(id: string, name: string, parentId: string | null) {
  return {
    id,
    user_id: "user",
    name,
    parent_id: parentId,
    category_type: "expense" as const,
    created_at: "2026-08-22T00:00:00Z",
    archived_at: null,
  }
}
