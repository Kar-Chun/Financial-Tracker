import { beforeEach, describe, expect, it, vi } from "vitest"

import { getSpendingAnalytics } from "@/features/analytics/analytics-service"
import { UnexpectedRpcResponseError } from "@/lib/rpc-validation"

const supabaseMock = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock("@/lib/supabase", () => ({ getSupabaseClient: () => supabaseMock }))

const range = {
  startDate: "2026-09-01",
  endDate: "2026-09-04",
  previousStartDate: "2026-08-01",
  previousEndDate: "2026-08-04",
  trendGranularity: "day" as const,
}

beforeEach(() => {
  supabaseMock.rpc.mockReset()
})

describe("Analytics RPC validation", () => {
  it("accepts a valid response including nullable category fields", async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: {
        period: {
          start_date: "2026-09-01",
          end_date: "2026-09-04",
          previous_start_date: "2026-08-01",
          previous_end_date: "2026-08-04",
          trend_granularity: "day",
        },
        summary: {
          total_spent_minor: 500,
          average_daily_spend_minor: 125,
          expense_count: 1,
          largest_category_name: null,
        },
        previous_summary: { total_spent_minor: 0, expense_count: 0 },
        categories: [{
          category_id: null,
          name: "Uncategorised",
          amount_minor: 500,
          previous_amount_minor: 0,
          direct_amount_minor: 500,
          subcategories: [],
        }],
        trend: [{ bucket_date: "2026-09-01", amount_minor: 500 }],
        excluded_foreign_expense_count: 0,
      },
      error: null,
    })

    const result = await getSpendingAnalytics(range)

    expect(result.summary.total_spent_minor).toBe(500)
    expect(result.categories[0]?.category_id).toBeNull()
  })

  it("rejects malformed money fields", async () => {
    supabaseMock.rpc.mockResolvedValue({ data: { summary: { total_spent_minor: "500" } }, error: null })

    await expect(getSpendingAnalytics(range)).rejects.toBeInstanceOf(UnexpectedRpcResponseError)
  })
})
