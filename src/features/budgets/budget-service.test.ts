import { beforeEach, describe, expect, it, vi } from "vitest"

import { copyPreviousBudget, getMonthlyBudgetSummary } from "@/features/budgets/budget-service"
import { UnexpectedRpcResponseError } from "@/lib/rpc-validation"

const supabaseMock = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock("@/lib/supabase", () => ({ getSupabaseClient: () => supabaseMock }))

beforeEach(() => {
  supabaseMock.rpc.mockReset()
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true })
})

describe("budget summary RPC validation", () => {
  it("accepts a no-budget response with nullable calculated fields", async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: {
        month_start: "2026-09-01",
        month_end: "2026-09-30",
        period_status: "current",
        budget_exists: false,
        previous_budget_exists: false,
        budget_id: null,
        currency_code: "SGD",
        currency_mismatch: false,
        overall_budget_minor: null,
        spent_minor: 0,
        remaining_minor: null,
        over_budget_minor: null,
        days_in_month: 30,
        elapsed_days: 4,
        remaining_days_including_today: 27,
        safe_daily_spend_minor: null,
        expected_spend_minor: null,
        pace_status: "no_budget",
        category_budgets: [],
        excluded_foreign_expense_count: 0,
      },
      error: null,
    })

    const result = await getMonthlyBudgetSummary("2026-09-01")

    expect(result.budget_id).toBeNull()
    expect(result.safe_daily_spend_minor).toBeNull()
  })

  it("rejects an unknown pace status", async () => {
    supabaseMock.rpc.mockResolvedValue({ data: { pace_status: "bad_status" }, error: null })

    await expect(getMonthlyBudgetSummary("2026-09-01")).rejects.toBeInstanceOf(UnexpectedRpcResponseError)
  })

  it("validates the copy result before the UI reads skipped categories", async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: {
        monthly_budget_id: "budget-id",
        copied_category_count: 2,
        skipped_category_count: 1,
      },
      error: null,
    })
    await expect(copyPreviousBudget({
      sourceMonthStart: "2026-08-01",
      destinationMonthStart: "2026-09-01",
    })).resolves.toEqual(expect.objectContaining({ skipped_category_count: 1 }))

    supabaseMock.rpc.mockResolvedValueOnce({
      data: { monthly_budget_id: "budget-id", skipped_category_count: "1" },
      error: null,
    })
    await expect(copyPreviousBudget({
      sourceMonthStart: "2026-08-01",
      destinationMonthStart: "2026-09-01",
    })).rejects.toBeInstanceOf(UnexpectedRpcResponseError)
  })
})
