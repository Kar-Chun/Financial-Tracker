import { describe, expect, it } from "vitest"

import { formatBudgetMonth, getBudgetCalendarPosition, getCurrentMonthStart, shiftMonthStart } from "@/features/budgets/budget-dates"

describe("budget calendar months", () => {
  it("uses the profile timezone at a UTC month boundary", () => {
    const instant = new Date("2026-08-31T16:30:00.000Z")
    expect(getCurrentMonthStart("Asia/Singapore", instant)).toBe("2026-09-01")
    expect(getCurrentMonthStart("America/New_York", instant)).toBe("2026-08-01")
  })

  it("moves across year boundaries and formats the selected month", () => {
    expect(shiftMonthStart("2026-12-01", 1)).toBe("2027-01-01")
    expect(shiftMonthStart("2026-01-01", -1)).toBe("2025-12-01")
    expect(formatBudgetMonth("2026-08-01")).toBe("August 2026")
  })

  it("uses the correct month length and counts the current day", () => {
    expect(getBudgetCalendarPosition("2026-08-01", "2026-08-24")).toEqual({ period: "current", daysInMonth: 31, elapsedDays: 24, remainingDaysIncludingToday: 8 })
    expect(getBudgetCalendarPosition("2028-02-01", "2028-02-29").daysInMonth).toBe(29)
    expect(getBudgetCalendarPosition("2026-07-01", "2026-08-01").period).toBe("past")
    expect(getBudgetCalendarPosition("2026-09-01", "2026-08-24").period).toBe("future")
  })
})
