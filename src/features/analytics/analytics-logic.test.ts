import { describe, expect, it } from "vitest"

import { getSpendingComparison } from "@/features/analytics/analytics-logic"
import { getAnalyticsPeriod } from "@/features/analytics/analytics-periods"
import { aggregateExpenseFacts, type ExpenseFact } from "@/test/reference-models/analytics-reference-model"

const expense = (overrides: Partial<ExpenseFact> = {}): ExpenseFact => ({
  transactionType: "expense",
  amountMinor: 1_005,
  deletedAt: null,
  categoryId: "eating-out",
  categoryName: "Eating Out",
  parentCategoryId: "food",
  parentCategoryName: "Food",
  ...overrides,
})

describe("spending analytics", () => {
  it("includes only active expenses and keeps exact integer minor units", () => {
    const result = aggregateExpenseFacts([
      expense(),
      expense({ amountMinor: 2_005 }),
      expense({ transactionType: "income", amountMinor: 50_000 }),
      expense({ transactionType: "transfer", amountMinor: 20_000 }),
      expense({ deletedAt: "2026-08-23T00:00:00Z", amountMinor: 9_999 }),
    ])

    expect(result.totalSpentMinor).toBe(3_010)
  })

  it("rolls subcategories into their parent while preserving child totals", () => {
    const result = aggregateExpenseFacts([
      expense({ amountMinor: 1_800 }),
      expense({ categoryId: "groceries", categoryName: "Groceries", amountMinor: 1_100 }),
      expense({ categoryId: "food", categoryName: "Food", parentCategoryId: null, parentCategoryName: null, amountMinor: 300 }),
    ])

    expect(result.categories.get("food")?.amountMinor).toBe(3_200)
    expect(result.categories.get("food")?.subcategories.get("eating-out")).toBe(1_800)
    expect(result.categories.get("food")?.subcategories.get("groceries")).toBe(1_100)
  })

  it("calculates increases and decreases against a non-zero prior period", () => {
    expect(getSpendingComparison(8_000, 10_000)).toEqual({ percentage: 20, direction: "decrease" })
    expect(getSpendingComparison(12_500, 10_000)).toEqual({ percentage: 25, direction: "increase" })
  })

  it("never returns Infinity or NaN when prior spending is zero", () => {
    const comparison = getSpendingComparison(8_000, 0)
    expect(comparison).toEqual({ percentage: null, direction: "no_prior" })
    expect(Number.isFinite(comparison.percentage ?? 0)).toBe(true)
  })

  it("compares a partial current month with the same elapsed prior-month days", () => {
    expect(getAnalyticsPeriod("this_month", "2026-08-22")).toEqual({
      startDate: "2026-08-01",
      endDate: "2026-08-22",
      previousStartDate: "2026-07-01",
      previousEndDate: "2026-07-22",
      trendGranularity: "day",
    })
  })

  it("compares completed months and multi-month ranges with equivalent periods", () => {
    expect(getAnalyticsPeriod("last_month", "2026-08-22")).toMatchObject({
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      previousStartDate: "2026-06-01",
      previousEndDate: "2026-06-30",
    })
    const range = getAnalyticsPeriod("last_3_months", "2026-08-22")
    const days = (start: string, end: string) => (Date.parse(end) - Date.parse(start)) / 86_400_000 + 1
    expect(days(range.startDate, range.endDate)).toBe(days(range.previousStartDate, range.previousEndDate))
  })

  it("returns an empty deterministic aggregate when there are no expenses", () => {
    const result = aggregateExpenseFacts([])
    expect(result.totalSpentMinor).toBe(0)
    expect(result.categories.size).toBe(0)
  })
})
