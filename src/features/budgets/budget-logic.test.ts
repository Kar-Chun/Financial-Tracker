import { describe, expect, it } from "vitest"

import { getBudgetProgress, isEligibleParentExpenseCategory } from "@/features/budgets/budget-logic"

describe("monthly budget calculations", () => {
  it("caps visual progress without hiding overspending", () => {
    expect(getBudgetProgress(112_000, 100_000)).toEqual({ percentageUsed: 112, visualPercentage: 100 })
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
