import { describe, expect, it } from "vitest"

import { getBudgetProgress, isEligibleParentExpenseCategory } from "@/features/budgets/budget-logic"
import { getPaceStatus, getRemainingBudget, getSafeDailySpend, sumEligibleBudgetSpending, sumParentCategorySpending, type BudgetExpenseFact } from "@/test/reference-models/budget-reference-model"

const baseFact: BudgetExpenseFact = { amountMinor: 500, transactionType: "expense", deleted: false, accountCurrency: "SGD", baseCurrency: "SGD", parentCategoryId: "food" }

describe("monthly budget calculations", () => {
  it("uses the analytics spending definition exactly", () => {
    const facts: BudgetExpenseFact[] = [
      baseFact,
      { ...baseFact, transactionType: "transfer", amountMinor: 1000 },
      { ...baseFact, transactionType: "income", amountMinor: 1000 },
      { ...baseFact, transactionType: "adjustment", amountMinor: 1000 },
      { ...baseFact, transactionType: "refund", amountMinor: 1000 },
      { ...baseFact, deleted: true, amountMinor: 1000 },
      { ...baseFact, accountCurrency: "USD", amountMinor: 1000 },
    ]
    expect(sumEligibleBudgetSpending(facts)).toBe(500)
  })

  it("rolls direct and child expense facts into their parent only", () => {
    const facts = [baseFact, { ...baseFact, amountMinor: 700 }, { ...baseFact, amountMinor: 900, parentCategoryId: "transport" }]
    expect(sumParentCategorySpending(facts, "food")).toBe(1200)
  })

  it("calculates remaining, over-budget, and bounded visual progress", () => {
    expect(getRemainingBudget(100_000, 51_580)).toEqual({ remainingMinor: 48_420, overBudgetMinor: 0 })
    expect(getRemainingBudget(100_000, 108_000)).toEqual({ remainingMinor: -8_000, overBudgetMinor: 8_000 })
    expect(getBudgetProgress(112_000, 100_000)).toEqual({ percentageUsed: 112, visualPercentage: 100 })
  })

  it("uses exact minor-unit daily division including today and returns zero over budget", () => {
    expect(getSafeDailySpend(48_420, 8, true)).toBe(6_053)
    expect(getSafeDailySpend(-8_000, 8, true)).toBe(0)
    expect(getSafeDailySpend(48_420, 8, false)).toBeNull()
  })

  it("classifies current, future, and completed pace without judgement", () => {
    expect(getPaceStatus({ budgetMinor: 100_000, spentMinor: 50_000, elapsedDays: 20, daysInMonth: 31, period: "current" }).status).toBe("on_track")
    expect(getPaceStatus({ budgetMinor: 100_000, spentMinor: 70_000, elapsedDays: 15, daysInMonth: 30, period: "current" }).status).toBe("ahead_of_pace")
    expect(getPaceStatus({ budgetMinor: 100_000, spentMinor: 100_001, elapsedDays: 20, daysInMonth: 31, period: "current" }).status).toBe("over_budget")
    expect(getPaceStatus({ budgetMinor: 100_000, spentMinor: 80_000, elapsedDays: 31, daysInMonth: 31, period: "past" }).status).toBe("within_budget")
    expect(getPaceStatus({ budgetMinor: 100_000, spentMinor: 0, elapsedDays: 0, daysInMonth: 30, period: "future" }).status).toBe("not_started")
  })

  it("handles February and exact integer minor units", () => {
    expect(getPaceStatus({ budgetMinor: 100_001, spentMinor: 50_000, elapsedDays: 14, daysInMonth: 28, period: "current" }).expectedMinor).toBe(50_001)
  })

  it("allows only the current user's active parent expense categories", () => {
    const category = { user_id: "user-a", category_type: "expense" as const, parent_id: null, archived_at: null }
    expect(isEligibleParentExpenseCategory(category, "user-a")).toBe(true)
    expect(isEligibleParentExpenseCategory({ ...category, category_type: "income" }, "user-a")).toBe(false)
    expect(isEligibleParentExpenseCategory({ ...category, parent_id: "food" }, "user-a")).toBe(false)
    expect(isEligibleParentExpenseCategory({ ...category, archived_at: "2026-08-24T00:00:00Z" }, "user-a")).toBe(false)
    expect(isEligibleParentExpenseCategory(category, "user-b")).toBe(false)
  })
})
