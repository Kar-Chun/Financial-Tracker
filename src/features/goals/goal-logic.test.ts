import { describe, expect, it } from "vitest"

import { applyAllocation, getAllocationSummary, getAvailableCash, getGoalProgress, getRequiredMonthly, goalFormSchema, parsePositiveGoalTarget, sumAllocations } from "@/features/goals/goal-logic"
import type { AccountSummaryRow } from "@/types/finance"

const account = (overrides: Partial<AccountSummaryRow>): AccountSummaryRow => ({
  id: "account", name: "Account", account_type: "bank", institution: null, currency_code: "SGD",
  opening_balance_minor: 0, current_balance_minor: 0, native_value_minor: null, base_value_minor: null,
  valued_at: null, included_in_net_worth: true, created_at: "2026-01-01", updated_at: "2026-01-01", ...overrides,
})

describe("savings goal calculations", () => {
  it("validates a trimmed name and positive target input shape", () => {
    expect(goalFormSchema.safeParse({ name: "Japan Trip", targetAmount: "3000.00", targetDate: "", note: "Flights" }).success).toBe(true)
    expect(goalFormSchema.safeParse({ name: " ", targetAmount: "3000.00", targetDate: "", note: "" }).success).toBe(false)
    expect(parsePositiveGoalTarget("3000.00", "SGD")).toBe(300_000)
    expect(() => parsePositiveGoalTarget("0.00", "SGD")).toThrow("greater than zero")
  })

  it("allocates and reduces signed history without going below zero", () => {
    expect(sumAllocations([20_000, 30_000, -10_000])).toBe(40_000)
    expect(applyAllocation(40_000, "allocate", 10_000)).toBe(50_000)
    expect(applyAllocation(40_000, "reduce", 10_000)).toBe(30_000)
    expect(() => applyAllocation(10_000, "reduce", 15_000)).toThrow("below zero")
  })

  it("allows allocation above target and caps only visual progress", () => {
    expect(getGoalProgress(0, 100_000)).toEqual({ percentage: 0, visualPercentage: 0, remainingMinor: 100_000, reached: false })
    expect(getGoalProgress(50_000, 100_000).percentage).toBe(50)
    expect(getGoalProgress(100_000, 100_000).reached).toBe(true)
    expect(getGoalProgress(110_000, 100_000)).toEqual({ percentage: 110, visualPercentage: 100, remainingMinor: 0, reached: true })
  })

  it("includes only represented base-currency bank and cash balances", () => {
    const accounts = [
      account({ current_balance_minor: 300_000 }),
      account({ id: "cash", account_type: "cash", current_balance_minor: 200_000 }),
      account({ id: "investment", account_type: "investment", current_balance_minor: null, base_value_minor: 900_000 }),
      account({ id: "usd", account_type: "cash", currency_code: "USD", current_balance_minor: 50_000, included_in_net_worth: false }),
    ]
    expect(getAvailableCash(accounts, "SGD")).toBe(500_000)
    expect(getAllocationSummary(500_000, [200_000, 150_000])).toEqual({ totalAllocatedMinor: 350_000, unallocatedCashMinor: 150_000 })
    expect(getAllocationSummary(200_000, [250_000]).unallocatedCashMinor).toBe(-50_000)
  })

  it("calculates inclusive calendar-month guidance with ceiling rounding", () => {
    expect(getRequiredMonthly({ remainingMinor: 220_000, targetDate: "2026-12-20", localToday: "2026-08-24", reached: false })).toEqual({ requiredMonthlyMinor: 44_000, monthsRemaining: 5, targetDatePassed: false })
    expect(getRequiredMonthly({ remainingMinor: 100_001, targetDate: "2026-08-31", localToday: "2026-08-01", reached: false }).requiredMonthlyMinor).toBe(100_001)
    expect(getRequiredMonthly({ remainingMinor: 100_001, targetDate: "2026-10-01", localToday: "2026-08-31", reached: false }).requiredMonthlyMinor).toBe(33_334)
    expect(getRequiredMonthly({ remainingMinor: 1, targetDate: "2026-07-31", localToday: "2026-08-01", reached: false }).targetDatePassed).toBe(true)
    expect(getRequiredMonthly({ remainingMinor: 0, targetDate: "2026-12-01", localToday: "2026-08-01", reached: true }).requiredMonthlyMinor).toBeNull()
    expect(getRequiredMonthly({ remainingMinor: 100, targetDate: null, localToday: "2026-08-01", reached: false }).requiredMonthlyMinor).toBeNull()
  })

  it("does not mutate any accounting metric when allocation changes", () => {
    const financialState = Object.freeze({ accountBalance: 500_000, transactions: 4, entries: 5, netWorth: 500_000, budgetSpent: 25_000, analyticsSpent: 25_000, cashFlow: 10_000 })
    expect(applyAllocation(0, "allocate", 100_000)).toBe(100_000)
    expect(financialState).toEqual({ accountBalance: 500_000, transactions: 4, entries: 5, netWorth: 500_000, budgetSpent: 25_000, analyticsSpent: 25_000, cashFlow: 10_000 })
  })
})
