import { describe, expect, it } from "vitest"

import { getGoalProgress, getRequiredMonthly, goalFormSchema, parsePositiveGoalTarget } from "@/features/goals/goal-logic"

describe("savings goal calculations", () => {
  it("validates a trimmed name and positive target input shape", () => {
    expect(goalFormSchema.safeParse({ name: "Japan Trip", targetAmount: "3000.00", targetDate: "", note: "Flights" }).success).toBe(true)
    expect(goalFormSchema.safeParse({ name: " ", targetAmount: "3000.00", targetDate: "", note: "" }).success).toBe(false)
    expect(parsePositiveGoalTarget("3000.00", "SGD")).toBe(300_000)
    expect(() => parsePositiveGoalTarget("0.00", "SGD")).toThrow("greater than zero")
  })

  it("allows allocation above target and caps only visual progress", () => {
    expect(getGoalProgress(0, 100_000)).toEqual({ percentage: 0, visualPercentage: 0, remainingMinor: 100_000, reached: false })
    expect(getGoalProgress(50_000, 100_000).percentage).toBe(50)
    expect(getGoalProgress(100_000, 100_000).reached).toBe(true)
    expect(getGoalProgress(110_000, 100_000)).toEqual({ percentage: 110, visualPercentage: 100, remainingMinor: 0, reached: true })
  })

  it("calculates inclusive calendar-month guidance with ceiling rounding", () => {
    expect(getRequiredMonthly({ remainingMinor: 220_000, targetDate: "2026-12-20", localToday: "2026-08-24", reached: false })).toEqual({ requiredMonthlyMinor: 44_000, monthsRemaining: 5, targetDatePassed: false })
    expect(getRequiredMonthly({ remainingMinor: 100_001, targetDate: "2026-08-31", localToday: "2026-08-01", reached: false }).requiredMonthlyMinor).toBe(100_001)
    expect(getRequiredMonthly({ remainingMinor: 100_001, targetDate: "2026-10-01", localToday: "2026-08-31", reached: false }).requiredMonthlyMinor).toBe(33_334)
    expect(getRequiredMonthly({ remainingMinor: 1, targetDate: "2026-07-31", localToday: "2026-08-01", reached: false }).targetDatePassed).toBe(true)
    expect(getRequiredMonthly({ remainingMinor: 0, targetDate: "2026-12-01", localToday: "2026-08-01", reached: true }).requiredMonthlyMinor).toBeNull()
    expect(getRequiredMonthly({ remainingMinor: 100, targetDate: null, localToday: "2026-08-01", reached: false }).requiredMonthlyMinor).toBeNull()
  })
})
