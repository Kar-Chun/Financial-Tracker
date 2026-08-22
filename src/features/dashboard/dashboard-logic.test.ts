import { describe, expect, it } from "vitest"

import { getMonthlySummary, groupExpensesByParent } from "@/features/dashboard/dashboard-logic"
import type { Category } from "@/types/database"
import type { TransactionRecord } from "@/types/finance"

describe("dashboard financial calculations", () => {
  it("counts only base-currency income and expenses", () => {
    const transactions = [
      record("income", 100_000, "SGD"),
      record("expense", -20_000, "SGD"),
      record("income", 50_000, "USD"),
      record("transfer", -10_000, "SGD", 10_000),
    ]

    expect(getMonthlySummary(transactions, "SGD", "2026-08")).toEqual({
      incomeMinor: 100_000,
      expensesMinor: 20_000,
      netCashFlowMinor: 80_000,
    })
  })

  it("aggregates subcategories under their parent", () => {
    const categories: Category[] = [
      category("food", "Food", null),
      category("groceries", "Groceries", "food"),
    ]
    const expense = record("expense", -12_50, "SGD")
    expense.category_id = "groceries"

    expect(groupExpensesByParent([expense], categories, "SGD", "2026-08")).toEqual([
      { label: "Food", amountMinor: 1_250 },
    ])
  })
})

function record(
  type: TransactionRecord["transaction_type"],
  amount: number,
  currencyCode: string,
  secondAmount?: number,
): TransactionRecord {
  const amounts = secondAmount === undefined ? [amount] : [amount, secondAmount]
  return {
    id: `${type}-${currencyCode}`,
    transaction_type: type,
    category_id: null,
    description: null,
    transaction_date: "2026-08-22",
    created_at: "2026-08-22T00:00:00Z",
    category: null,
    entries: amounts.map((entryAmount, index) => ({
      id: `${type}-${index}`,
      account_id: `${currencyCode}-${index}`,
      amount_minor: entryAmount,
      account: {
        id: `${currencyCode}-${index}`,
        name: "Account",
        currency_code: currencyCode,
        account_type: "bank",
      },
    })),
  }
}

function category(id: string, name: string, parentId: string | null): Category {
  return {
    id,
    user_id: "user",
    name,
    parent_id: parentId,
    category_type: "expense",
    created_at: "2026-08-22T00:00:00Z",
    archived_at: null,
  }
}
